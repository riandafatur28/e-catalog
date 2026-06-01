/**
 * HD Single-Page Flipbook with Turn.js
 * Tema: Ngawiti 2 — Tilas ing Jagad
 * Disporabudpar, Kabupaten Nganjuk
 */

pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let $flipbook = null;
let pdfDoc = null;
let totalPages = 1;
let isFlipping = false;
let preloadCache = {};
let currentZoom = 1;
let panX = 0;
let panY = 0;
let hideIslandTimeout = null;
let navIsland = null;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.2;
const ZOOM_RESET = 1;

function getFileExtension(file) {
    const match = String(file || '').toLowerCase().match(/\.([a-z0-9]+)(?:[\?#].*)?$/);
    return match ? match[1] : '';
}

function normalizeFileType(file, declaredType) {
    const ext = getFileExtension(file);
    if (ext) return ext;
    if (!declaredType) return 'file';
    const normalized = String(declaredType).toLowerCase();
    if (normalized.includes('ppt')) return 'pptx';
    if (normalized.includes('word') || normalized.includes('doc')) return 'docx';
    if (normalized.includes('excel') || normalized.includes('xls')) return 'xlsx';
    if (normalized.includes('pdf')) return 'pdf';
    if (normalized.includes('image') || normalized.includes('jpg') || normalized.includes('png')) return 'png';
    if (normalized.includes('video')) return 'mp4';
    if (normalized.includes('audio') || normalized.includes('music')) return 'mp3';
    return 'file';
}

function isImageType(type) {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type);
}

function isVideoType(type) {
    return ['mp4', 'webm', 'ogg'].includes(type);
}

function isAudioType(type) {
    return ['mp3', 'wav', 'aac', 'flac'].includes(type);
}

function isPdfType(type) {
    return type === 'pdf';
}

function hideNavigationControls() {
    const controls = document.querySelector('.bottom-controls');
    if (controls) controls.style.display = 'none';
}

function showNavigationControls() {
    const controls = document.querySelector('.bottom-controls');
    if (controls) controls.style.display = 'flex';
}

async function displayMediaViewer(url, type, karya) {
    const container = document.getElementById('flipbook');
    const loader = document.getElementById('loader-container');
    const loaderTextEl = document.getElementById('loader-text');
    if (!container || !loader || !loaderTextEl) return;
    container.classList.add('media-viewer');
    container.innerHTML = '';
    showNavigationControls();
    // indicate single-page media so prev/next are disabled
    totalPages = 1;
    
    if (isImageType(type)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.alt = karya.title || 'Preview gambar';
        img.onload = () => {
            const screenWidth = window.innerWidth * 0.96;
            const screenHeight = window.innerHeight * 0.86;
            const aspect = img.naturalWidth / img.naturalHeight;
            let targetWidth = screenWidth;
            let targetHeight = targetWidth / aspect;
            if (targetHeight > screenHeight) {
                targetHeight = screenHeight;
                targetWidth = targetHeight * aspect;
            }
            const dpr = Math.max(window.devicePixelRatio || 1, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(targetWidth * dpr);
            canvas.height = Math.round(targetHeight * dpr);
            canvas.style.width = `${Math.round(targetWidth)}px`;
            canvas.style.height = `${Math.round(targetHeight)}px`;
            canvas.style.maxWidth = '96vw';
            canvas.style.maxHeight = '86vh';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
            container.appendChild(canvas);
            loader.style.display = 'none';
            setupGestureAndIsland(container, false);
        };
        img.onerror = () => showError('Gagal memuat gambar.');
        setLoaderText('Menampilkan gambar...');
        updateNavButtons(1);
        updatePageIndicator(1);
        return;
    }

    if (isVideoType(type)) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.autoplay = false;
        video.playsInline = true;
        video.preload = 'metadata';
        video.style.width = '96vw';
        video.style.maxWidth = '96vw';
        video.style.height = 'auto';
        video.style.maxHeight = '86vh';
        video.style.display = 'block';
        video.style.margin = '0 auto';
        video.onloadeddata = () => { loader.style.display = 'none'; };
        video.onerror = () => showError('Gagal memuat video.');
        container.appendChild(video);
        setLoaderText('Menampilkan video...');
        updateNavButtons(1);
        updatePageIndicator(1);
        setupGestureAndIsland(container, false);
        return;
    }

    if (isAudioType(type)) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.minHeight = '100vh';
        wrapper.style.gap = '18px';
        const icon = document.createElement('div');
        icon.textContent = '🎧';
        icon.style.fontSize = '84px';
        const label = document.createElement('div');
        label.textContent = karya.title || 'Audio';
        label.style.color = '#F5EDD8';
        label.style.fontFamily = 'Inter, sans-serif';
        label.style.fontSize = '18px';
        label.style.textAlign = 'center';
        const audio = document.createElement('audio');
        audio.src = url;
        audio.controls = true;
        audio.style.width = '100%';
        audio.oncanplay = () => { loader.style.display = 'none'; };
        audio.onerror = () => showError('Gagal memuat audio.');
        wrapper.appendChild(icon);
        wrapper.appendChild(label);
        wrapper.appendChild(audio);
        container.appendChild(wrapper);
        setLoaderText('Menampilkan audio...');
        updateNavButtons(1);
        updatePageIndicator(1);
        setupGestureAndIsland(container, false);
        return;
    }

    setLoaderText('Membuka file...');
    setTimeout(() => {
        window.open(url, '_blank');
        window.location.href = 'index.html';
    }, 1200);
}

document.addEventListener('DOMContentLoaded', async () => {
    await initFlipbook();
});

async function initFlipbook() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) { window.location.href = 'index.html'; return; }

    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const karya = data.find(k => String(k.id) === String(id));
        if (!karya) throw new Error('Karya tidak ditemukan');

        document.getElementById('book-title').textContent = karya.title;
        document.getElementById('book-artist').textContent =
            `${karya.artist} • ${karya.medium || 'N/A'} • ${karya.year}`;
        document.title = `Ngawiti 2 | karya | ${karya.title}`;
        document.getElementById('download-btn').href = karya.file;

        const fileType = normalizeFileType(karya.file, karya.type);
        if (!isPdfType(fileType)) {
            await displayMediaViewer(karya.file, fileType, karya);
            return;
        }

        showNavigationControls();
        document.getElementById('flipbook')?.classList.remove('media-viewer');
        await loadAndRenderPDF(karya.file);
    } catch (error) {
        console.error('Init error:', error);
        showError(`Gagal memuat: ${error.message}`);
    }
}

async function loadAndRenderPDF(pdfUrl) {
    try {
        setLoaderText('Mengunduh PDF...');
        pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
        totalPages = pdfDoc.numPages;
        setLoaderText('Menyiapkan halaman pertama...');

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);

        const flipbookContainer = document.getElementById('flipbook');
        flipbookContainer.innerHTML = '';

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.dataset.pageNumber = pageNum;
            pageDiv.dataset.rendered = 'false';

            const canvas = document.createElement('canvas');
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.transformOrigin = 'center center';
            pageDiv.appendChild(canvas);
            flipbookContainer.appendChild(pageDiv);
        }

        await renderPdfPage(1, screenWidth, screenHeight, devicePixelRatio);
        document.getElementById('loader-container').style.display = 'none';
        initTurnFlipbook();
        const schedule = (fn) => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(fn, { timeout: 500 });
            } else {
                setTimeout(fn, 100);
            }
        };
        schedule(() => preloadAdjacentPages(1));
    } catch (error) {
        console.error('PDF error:', error);
        showError(`Gagal memuat PDF: ${error.message}`);
    }
}

async function renderPdfPage(pageNum, screenWidth, screenHeight, devicePixelRatio) {
    if (!pdfDoc) return;
    const pageDiv = document.querySelector(`.page[data-page-number="${pageNum}"]`);
    if (!pageDiv) return;
    const canvas = pageDiv.querySelector('canvas');
    if (!canvas || canvas.dataset.rendered === 'true') return;

    try {
        const page = await pdfDoc.getPage(pageNum);
        const defaultVP = page.getViewport({ scale: 1 });
            const widthScale = (screenWidth * 0.96) / defaultVP.width;
            const heightScale = (screenHeight * 0.94) / defaultVP.height;
            const fitScale = Math.min(widthScale, heightScale);
            const qualityScale = Math.max(devicePixelRatio, 1.8);
            const hdScale = Math.min(Math.max(fitScale, 1) * qualityScale, 4);
        const viewport = page.getViewport({ scale: hdScale });
        const ctx = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise;

        canvas.dataset.rendered = 'true';
        preloadCache[pageNum] = canvas;
    } catch (error) {
        console.warn('Render page failed:', pageNum, error);
    }
}

function setupGestureAndIsland(flipbookEl, allowPaging = false) {
    if (!flipbookEl) return;
    flipbookEl.style.touchAction = 'auto';

    navIsland = document.querySelector('.nav-island');
    if (navIsland) {
        // default hidden; will show on interaction
        navIsland.classList.remove('visible');
    }

    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const zoomResetBtn = document.getElementById('btn-zoom-reset');

    if (prevBtn) prevBtn.onclick = () => { if (allowPaging && !isFlipping && $flipbook) $flipbook.turn('previous'); };
    if (nextBtn) nextBtn.onclick = () => { if (allowPaging && !isFlipping && $flipbook) $flipbook.turn('next'); };
    if (zoomInBtn) zoomInBtn.onclick = () => changeZoom(ZOOM_STEP);
    if (zoomOutBtn) zoomOutBtn.onclick = () => changeZoom(-ZOOM_STEP);
    if (zoomResetBtn) zoomResetBtn.onclick = resetZoom;

    const showNavIsland = () => {
        if (!navIsland) return;
        navIsland.classList.add('visible');
        clearTimeout(hideIslandTimeout);
        hideIslandTimeout = setTimeout(() => {
            navIsland.classList.remove('visible');
        }, 1200);
    };

    const maybeShowIsland = (y) => {
        if (y > window.innerHeight - 140) {
            showNavIsland();
        }
    };

    window.addEventListener('mousemove', (e) => {
        maybeShowIsland(e.clientY);
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
        if (!e.touches.length) return;
        maybeShowIsland(e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!e.touches.length) return;
        maybeShowIsland(e.touches[0].clientY);
    }, { passive: true });

    let touchStartX = 0;
    let touchStartY = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = currentZoom;
    let isPinching = false;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    flipbookEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            isPinching = true;
            isPanning = false;
            pinchStartDistance = Math.hypot(
                e.touches[0].screenX - e.touches[1].screenX,
                e.touches[0].screenY - e.touches[1].screenY
            );
            pinchStartZoom = currentZoom;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        if (zoomActive()) {
            isPanning = true;
            panStartX = e.changedTouches[0].clientX - panX;
            panStartY = e.changedTouches[0].clientY - panY;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false, capture: true });

    flipbookEl.addEventListener('touchmove', (e) => {
        if (isPinching && e.touches.length === 2) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const currentDistance = Math.hypot(
                e.touches[0].screenX - e.touches[1].screenX,
                e.touches[0].screenY - e.touches[1].screenY
            );
            const scaleFactor = currentDistance / pinchStartDistance;
            const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoom * scaleFactor));
            if (nextZoom !== currentZoom) {
                currentZoom = nextZoom;
                applyZoom();
            }
            return;
        }

        if (isPanning && e.touches.length === 1) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const touch = e.touches[0];
            panX = touch.clientX - panStartX;
            panY = touch.clientY - panStartY;
            applyZoom();
            return;
        }
    }, { passive: false, capture: true });

    flipbookEl.addEventListener('touchend', (e) => {
        if (isFlipping) return;
        if (e.touches.length < 2) isPinching = false;
        if (isPanning) {
            isPanning = false;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        if (!allowPaging) return;

        const diffX = touchStartX - e.changedTouches[0].screenX;
        const diffY = touchStartY - e.changedTouches[0].screenY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            e.preventDefault();
            diffX > 0 ? $flipbook.turn('next') : $flipbook.turn('previous');
        } else if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) {
            const touchX = e.changedTouches[0].screenX;
            if (touchX > window.innerWidth * 0.55) {
                $flipbook.turn('next');
            } else if (touchX < window.innerWidth * 0.45) {
                $flipbook.turn('previous');
            }
        }
    }, { passive: false, capture: true });

    flipbookEl.addEventListener('click', (e) => {
        if (zoomActive() || isFlipping) return;
        if (e.target.closest('.ctrl-btn') || e.target.closest('#download-btn') || e.target.closest('.btn-back')) return;
        if (!allowPaging) {
            // For single-page media, toggle nav-island on click
            if (navIsland) {
                if (navIsland.classList.contains('visible')) navIsland.classList.remove('visible');
                else showNavIsland();
            }
            return;
        }
        const clickX = e.clientX;
        if (clickX > window.innerWidth * 0.55) {
            $flipbook.turn('next');
        } else if (clickX < window.innerWidth * 0.45) {
            $flipbook.turn('previous');
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if ($flipbook && allowPaging) {
                $flipbook.turn('size', window.innerWidth, window.innerHeight);
                $flipbook.turn('center');
            }
        }, 200);
    });

    updatePageIndicator($flipbook ? ($flipbook.turn ? $flipbook.turn('page') : 1) : 1);
    updateNavButtons($flipbook ? ($flipbook.turn ? $flipbook.turn('page') : 1) : 1);
    preloadAdjacentPages($flipbook ? ($flipbook.turn ? $flipbook.turn('page') : 1) : 1);
    applyZoom();
}

function initTurnFlipbook() {
    const $book = $('#flipbook');
    const pageWidth = window.innerWidth;
    const pageHeight = window.innerHeight;

    $book.turn({
        width: pageWidth,
        height: pageHeight,
        autoCenter: true,
        display: 'single',
        acceleration: true,
        gradients: !$.isTouch,
        elevation: 50,
        duration: 700,
        when: {
            turning: function() {
                isFlipping = true;
                updateNavButtons();
            },
            turned: function(event, page) {
                isFlipping = false;
                updatePageIndicator(page);
                renderPdfPage(page, window.innerWidth, window.innerHeight, Math.max(window.devicePixelRatio || 1, 1));
                updateNavButtons(page);
                preloadAdjacentPages(page);
            }
        }
    });

    $flipbook = $book;
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const zoomResetBtn = document.getElementById('btn-zoom-reset');

    if (prevBtn) prevBtn.onclick = () => { if (!isFlipping && $flipbook) $flipbook.turn('previous'); };
    if (nextBtn) nextBtn.onclick = () => { if (!isFlipping && $flipbook) $flipbook.turn('next'); };
    if (zoomInBtn) zoomInBtn.onclick = () => changeZoom(ZOOM_STEP);
    if (zoomOutBtn) zoomOutBtn.onclick = () => changeZoom(-ZOOM_STEP);
    if (zoomResetBtn) zoomResetBtn.onclick = resetZoom;

    document.addEventListener('keydown', (e) => {
        if (isFlipping || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); $flipbook.turn('previous'); }
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); $flipbook.turn('next'); }
        if (e.key === 'Home') { e.preventDefault(); $flipbook.turn(1); }
        if (e.key === 'End') { e.preventDefault(); $flipbook.turn(totalPages); }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = currentZoom;
    let isPinching = false;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    const flipbookEl = $flipbook[0];
    if (!flipbookEl) return;
    // Attach gesture handlers and nav-island behaviour
    setupGestureAndIsland(flipbookEl, true);

    flipbookEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            isPinching = true;
            isPanning = false;
            pinchStartDistance = Math.hypot(
                e.touches[0].screenX - e.touches[1].screenX,
                e.touches[0].screenY - e.touches[1].screenY
            );
            pinchStartZoom = currentZoom;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        if (zoomActive()) {
            isPanning = true;
            panStartX = e.changedTouches[0].clientX - panX;
            panStartY = e.changedTouches[0].clientY - panY;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false, capture: true });

    flipbookEl.addEventListener('touchmove', (e) => {
        if (isPinching && e.touches.length === 2) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const currentDistance = Math.hypot(
                e.touches[0].screenX - e.touches[1].screenX,
                e.touches[0].screenY - e.touches[1].screenY
            );
            const scaleFactor = currentDistance / pinchStartDistance;
            const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoom * scaleFactor));
            if (nextZoom !== currentZoom) {
                currentZoom = nextZoom;
                applyZoom();
            }
            return;
        }

        if (isPanning && e.touches.length === 1) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const touch = e.touches[0];
            panX = touch.clientX - panStartX;
            panY = touch.clientY - panStartY;
            applyZoom();
            return;
        }
    }, { passive: false, capture: true });

    flipbookEl.addEventListener('touchend', (e) => {
        if (isFlipping) return;
        if (e.touches.length < 2) isPinching = false;
        if (isPanning) {
            isPanning = false;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        const diffX = touchStartX - e.changedTouches[0].screenX;
        const diffY = touchStartY - e.changedTouches[0].screenY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            e.preventDefault();
            diffX > 0 ? $flipbook.turn('next') : $flipbook.turn('previous');
        } else if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) {
            const touchX = e.changedTouches[0].screenX;
            if (touchX > window.innerWidth * 0.55) {
                $flipbook.turn('next');
            } else if (touchX < window.innerWidth * 0.45) {
                $flipbook.turn('previous');
            }
        }
    }, { passive: false, capture: true });

    flipbookEl.addEventListener('click', (e) => {
        if (zoomActive() || isFlipping) return;
        if (e.target.closest('.ctrl-btn') || e.target.closest('#download-btn') || e.target.closest('.btn-back')) return;
        const clickX = e.clientX;
        if (clickX > window.innerWidth * 0.55) {
            $flipbook.turn('next');
        } else if (clickX < window.innerWidth * 0.45) {
            $flipbook.turn('previous');
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if ($flipbook) {
                $flipbook.turn('size', window.innerWidth, window.innerHeight);
                $flipbook.turn('center');
            }
        }, 200);
    });

    updatePageIndicator(1);
    updateNavButtons(1);
    preloadAdjacentPages(1);
    applyZoom();
}

function updatePageIndicator(page) {
    const el = document.getElementById('page-indicator');
    if (el) el.textContent = `${page} / ${totalPages}`;
}

function updateNavButtons(page) {
    const cur = page || ($flipbook ? $flipbook.turn('page') : 1);
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) prev.disabled = cur <= 1;
    if (next) next.disabled = cur >= totalPages;
}

function zoomActive() {
    return currentZoom !== ZOOM_RESET;
}

function setLoaderText(text) {
    const el = document.getElementById('loader-text');
    if (el) el.textContent = text;
}

async function preloadAdjacentPages(current) {
    if (!pdfDoc) return;
    for (const pageNum of [current - 1, current + 1]) {
        if (pageNum < 1 || pageNum > totalPages) continue;
        if (preloadCache[pageNum]) continue;
        try {
            const page = await pdfDoc.getPage(pageNum);
            const defVP = page.getViewport({ scale: 1 });
            const dpr = Math.max(window.devicePixelRatio || 1, 1);
            const wScale = (window.innerWidth * dpr) / defVP.width;
            const hScale = (window.innerHeight * dpr) / defVP.height;
            const hdScale = Math.min(Math.min(wScale, hScale) * 1.4, 4);
            const viewport = page.getViewport({ scale: hdScale });
            const offscreen = document.createElement('canvas');
            const ctx = offscreen.getContext('2d');
            offscreen.width = viewport.width;
            offscreen.height = viewport.height;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise;
            preloadCache[pageNum] = offscreen;
        } catch (_) { }
    }
}

function showError(message) {
    const loader = document.getElementById('loader-container');
    const loaderText = document.getElementById('loader-text');
    if (!loaderText) return;
    loaderText.innerHTML = `
        <span style="color:#8B1A1A; font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:0.08em;">
            GAGAL MEMUAT
        </span><br>
        <span style="color:#C9AA6E; font-size:13px; display:block; margin-top:8px;">${message}</span>
        <button onclick="location.reload()"
                style="margin-top:16px; padding:10px 24px; background:#8B1A1A; color:#F5EDD8;
                       border:none; border-radius:7px; font-size:13px; font-weight:700;
                       font-family:'Inter',sans-serif; letter-spacing:0.06em;
                       text-transform:uppercase; cursor:pointer;">
            Coba Lagi
        </button>`;
    if (loader) loader.style.display = 'flex';
}

function applyZoom() {
    const flipbookEl = document.getElementById('flipbook');
    if (!flipbookEl) return;
    flipbookEl.style.transformOrigin = '50% 50%';
    flipbookEl.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    flipbookEl.style.touchAction = zoomActive() ? 'none' : 'manipulation';
    updateZoomIndicator();
    updateNavButtons();
}

function updateZoomIndicator() {
    const zoomLabel = document.getElementById('zoom-indicator');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
}

function changeZoom(amount) {
    const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, currentZoom + amount));
    if (nextZoom === currentZoom) return;
    currentZoom = nextZoom;
    applyZoom();
}

function resetZoom() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyZoom();
}

window.flipPrev = () => { if ($flipbook) $flipbook.turn('previous'); };
window.flipNext = () => { if ($flipbook) $flipbook.turn('next'); };
