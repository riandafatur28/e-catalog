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

        // Generate barcode panel
        generateBarcode(karya);

        if (!karya.file.endsWith('.pdf')) {
            setLoaderText('⚠️ Format bukan PDF');
            setTimeout(() => {
                window.open(karya.file, '_blank');
                window.location.href = 'index.html';
            }, 1500);
            return;
        }

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

function generateBarcode(karya) {
    try {
        const barcodeValue = String(karya.id);
        const barcodeSvg = document.getElementById('barcode-svg');
        
        JsBarcode('#barcode-svg', barcodeValue, {
            format: 'CODE128',
            width: 1.5,
            height: 50,
            margin: 4,
            lineColor: '#000000',
            displayValue: false
        });

        document.getElementById('barcode-title').textContent = karya.title;
        document.getElementById('barcode-artist').textContent = `${karya.artist}`;
    } catch (error) {
        console.error('Barcode generation error:', error);
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
        const widthScale = (screenWidth * 0.98 * devicePixelRatio) / defaultVP.width;
        const heightScale = (screenHeight * 0.94 * devicePixelRatio) / defaultVP.height;
        const baseScale = Math.min(widthScale, heightScale);
        const hdScale = Math.min(baseScale * 1.4, 4);
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

    navIsland = document.querySelector('.nav-island');
    if (navIsland) {
        navIsland.classList.remove('visible');
    }

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

    flipbookEl.style.touchAction = 'auto';

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
