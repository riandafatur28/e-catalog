/**
 * Offline Cache Manager — Ngawiti 2
 * Persistent storage untuk gambar & PDF di IndexedDB
 * Target: <300ms access time from cache, auto pre-cache on idle
 */

class OfflineCacheManager {
  constructor() {
    this.dbName = 'ngawiti-cache';
    this.dbVersion = 2;
    this.storeName = 'media';
    this.db = null;
    this.thumbnailCache = new Map(); // In-memory cache untuk quick access
    this.isInitialized = false;
    this.init();
  }

  async init() {
    try {
      this.db = await this.openDB();
      this.isInitialized = true;
      console.log('[Cache] IndexedDB initialized');
      
      // Auto cleanup old entries (>14 hari)
      this.cleanupOldEntries();
    } catch (err) {
      console.warn('[Cache] IndexedDB init failed:', err.message);
      // Graceful degradation - app still works without persistent cache
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);
      
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          console.log('[Cache] IndexedDB store created');
        }
      };
      
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('IndexedDB open failed'));
    });
  }

  /**
   * Get cached media (thumbnail or full file)
   * @returns {Promise<{data: Blob, timestamp: number} | null>}
   */
  async get(url) {
    if (!this.isInitialized || !this.db) return null;
    
    try {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const req = store.get(url);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('[Cache] Get failed:', err.message);
      return null;
    }
  }

  /**
   * Set cached media with metadata
   */
  async set(url, blob, type = 'image') {
    if (!this.isInitialized || !this.db) return false;
    
    try {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const entry = {
          url,
          data: blob,
          type,
          timestamp: Date.now(),
          size: blob.size,
        };
        
        const req = store.put(entry);
        req.onsuccess = () => {
          console.log(`[Cache] Stored ${type}: ${url.substring(0, 50)}... (${this.formatSize(blob.size)})`);
          resolve(true);
        };
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('[Cache] Set failed:', err.message);
      return false;
    }
  }

  /**
   * Pre-cache media files (call on idle)
   */
  async preCacheFiles(urls, options = {}) {
    const { type = 'image', priority = 'low', maxConcurrent = 2 } = options;
    
    if (!this.isInitialized || !this.db) return 0;
    
    let cached = 0;
    const queue = [...urls];
    const inFlight = new Set();
    
    console.log(`[Cache] Starting pre-cache for ${urls.length} files (priority: ${priority})`);
    
    while (queue.length > 0 || inFlight.size > 0) {
      // Keep concurrency limit
      while (inFlight.size < maxConcurrent && queue.length > 0) {
        const url = queue.shift();
        const promise = this.cacheFile(url, type)
          .then(() => cached++)
          .catch(err => console.warn(`[Cache] Failed: ${url}`, err.message))
          .finally(() => inFlight.delete(promise));
        
        inFlight.add(promise);
      }
      
      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }
    
    console.log(`[Cache] Pre-cache complete: ${cached}/${urls.length} files cached`);
    return cached;
  }

  /**
   * Fetch and cache a single file
   */
  async cacheFile(url, type = 'image') {
    // Check if already cached
    const existing = await this.get(url);
    if (existing) return true;
    
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      
      // Size limits: images <5MB, PDFs <20MB
      const maxSize = type === 'pdf' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      if (blob.size > maxSize) {
        console.warn(`[Cache] File too large: ${url} (${this.formatSize(blob.size)})`);
        return false;
      }
      
      await this.set(url, blob, type);
      return true;
    } catch (err) {
      console.warn(`[Cache] Cache file failed: ${url}`, err.message);
      return false;
    }
  }

  /**
   * Get total cache size
   */
  async getSize() {
    if (!this.isInitialized || !this.db) return 0;
    
    try {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            total += cursor.value.size || 0;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    } catch (err) {
      return 0;
    }
  }

  /**
   * Clear cache (manual or auto cleanup)
   */
  async clear(type = null) {
    if (!this.isInitialized || !this.db) return false;
    
    try {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve) => {
        const req = type 
          ? store.index('type').getAll(type).then(entries => entries.forEach(e => store.delete(e.url)))
          : store.clear();
        
        req.onsuccess = () => {
          console.log(`[Cache] Cleared${type ? ' ' + type : ''}`);
          this.thumbnailCache.clear();
          resolve(true);
        };
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('[Cache] Clear failed:', err.message);
      return false;
    }
  }

  /**
   * Auto cleanup entries older than maxAge (in days)
   */
  async cleanupOldEntries(maxAgeDays = 14) {
    if (!this.isInitialized || !this.db) return 0;
    
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    
    try {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      return new Promise((resolve) => {
        const req = index.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (now - cursor.value.timestamp > maxAge) {
              store.delete(cursor.value.url);
              deleted++;
            }
            cursor.continue();
          } else {
            console.log(`[Cache] Cleanup: removed ${deleted} old entries`);
            resolve(deleted);
          }
        };
        req.onerror = () => resolve(0);
      });
    } catch (err) {
      return 0;
    }
  }

  /**
   * Get dataURL for use in <img> tags
   */
  async getDataURL(url) {
    // Check in-memory cache first
    if (this.thumbnailCache.has(url)) {
      return this.thumbnailCache.get(url);
    }
    
    // Check IndexedDB
    const cached = await this.get(url);
    if (cached) {
      const dataUrl = URL.createObjectURL(cached.data);
      this.thumbnailCache.set(url, dataUrl);
      return dataUrl;
    }
    
    return null;
  }

  /**
   * Utility: format bytes to human-readable
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Global instance
window.offlineCache = new OfflineCacheManager();

// Request idle callback for background pre-caching
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => {
    console.log('[Cache] Idle callback - ready for pre-caching');
  }, { timeout: 5000 });
}

export default window.offlineCache;