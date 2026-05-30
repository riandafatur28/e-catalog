/**
 * HD Single-Page Flipbook with Turn.js
 * Tema: Ngawiti 2 — Tilas ing Jagad
 * Disporabudpar, Kabupaten Nganjuk
 */

pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let $flipbook   = null;
let pdfDoc      = null;
let totalPages  = 1;
let isFlipping  = false;
let preloadCache = {};

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

        const data  = await res.json();
        const karya = data.find(k => String(k.id) === String(id));
        if (!karya) throw new Error('Karya tidak ditemukan');

        document.getElementById('book-title').textContent  = karya.title;
        document.getElementById('book-artist').textContent =
            `${karya.artist} \u2022 ${karya.medium || 'N/A'} \u2022 ${karya.year}`;
        document.getElementById('download-btn').href = karya.file;

        if (!karya.file.endsWith('.pdf')) {
            setLoaderText('\u26A0\uFE0F Format bukan PDF');
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

        pdfDoc     = await pdfjsLib.getDocument(pdfUrl).promise;
        totalPages = pdfDoc.numPages;

        setLoaderText(`Merender ${totalPages} halaman HD...`);

        const screenWidth       = window.innerWidth;
        const screenHeight      = window.innerHeight;
        const devicePixelRatio  = Math.max(window.devicePixelRatio || 1, 1);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page      = await pdfDoc.getPage(pageNum);
            const defaultVP = page.getViewport({ scale: 1 });

            const widthScale  = (screenWidth  * 0.98 * devicePixelRatio) / defaultVP.width;
            const heightScale = (screenHeight * 0.94 * devicePixelRatio) / defaultVP.height;
            const baseScale   = Math.min(widthScale, heightScale);
            const hdScale     = Math.min(baseScale * 1.8, 10);

            const viewport = page.getViewport({ scale: hdScale });

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.dataset.pageNumber = pageNum;

            const canvas = document.createElement('canvas');
            const ctx    = canvas.getContext('2d');
            canvas.width        = viewport.width;
            canvas.height       = viewport.height;
            canvas.style.width  = '100%';
            canvas.style.height = 'auto';
            ctx.imageSmoothingEnabled  = true;
            ctx.imageSmoothingQuality  = 'high';

            await page.render({
                canvasContext: ctx,
                viewport: viewport,
                intent: 'display'
            }).promise;

            pageDiv.appendChild(canvas);
            document.getElementById('flipbook').appendChild(pageDiv);

            /* update progress bar & text */
            const pct = Math.round((pageNum / totalPages) * 100);
            const bar = document.getElementById('loader-progress');
            if (bar) bar.style.width = pct + '%';

            if (pageNum % 5 === 0 || pageNum === totalPages) {
                setLoaderText(`Memproses: ${pageNum} / ${totalPages} halaman`);
            }
        }

        document.getElementById('loader-container').style.display = 'none';
        initTurnFlipbook();

    } catch (error) {
        console.error('PDF error:', error);
        showError(`Gagal memuat PDF: ${error.message}`);
    }
}

function initTurnFlipbook() {
    const $book     = $('#flipbook');
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
                updateNavButtons(page);
                preloadAdjacentPages(page);
            }
        }
    });

    $flipbook = $book;

    document.getElementById('btn-prev').onclick = () => {
        if (!isFlipping && $flipbook) $flipbook.turn('previous');
    };
    document.getElementById('btn-next').onclick = () => {
        if (!isFlipping && $flipbook) $flipbook.turn('next');
    };

    document.addEventListener('keydown', (e) => {
        if (isFlipping || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); $flipbook?.turn('previous'); }
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); $flipbook?.turn('next'); }
        if (e.key === 'Home') { e.preventDefault(); $flipbook?.turn(1); }
        if (e.key === 'End')  { e.preventDefault(); $flipbook?.turn(totalPages); }
    });

    /* Touch / swipe */
    let touchStartX = 0, touchStartY = 0;
    const flipbookEl = $flipbook[0];

    flipbookEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    flipbookEl.addEventListener('touchend', (e) => {
        if (isFlipping) return;
        const diffX = touchStartX - e.changedTouches[0].screenX;
        const diffY = touchStartY - e.changedTouches[0].screenY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            e.preventDefault();
            diffX > 0 ? $flipbook.turn('next') : $flipbook.turn('previous');
        }
    }, { passive: true });

    /* Resize */
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

    console.log(`Flipbook siap — ${totalPages} halaman, mode single, HD`);
}

/* ── Helpers ── */

function updatePageIndicator(page) {
    const el = document.getElementById('page-indicator');
    if (el) el.textContent = `${page} / ${totalPages}`;
}

function updateNavButtons(page) {
    const cur = page ?? ($flipbook ? $flipbook.turn('page') : 1);
    const prev = document.getElementById('btn-prev');
    const next = document.getElementById('btn-next');
    if (prev) prev.disabled = cur <= 1;
    if (next) next.disabled = cur >= totalPages;
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
            const page     = await pdfDoc.getPage(pageNum);
            const defVP    = page.getViewport({ scale: 1 });
            const dpr      = Math.max(window.devicePixelRatio || 1, 1);
            const wScale   = (window.innerWidth  * dpr) / defVP.width;
            const hScale   = (window.innerHeight * dpr) / defVP.height;
            const hdScale  = Math.min(Math.min(wScale, hScale) * 1.8, 10);
            const viewport = page.getViewport({ scale: hdScale });

            const offscreen = document.createElement('canvas');
            const ctx = offscreen.getContext('2d');
            offscreen.width  = viewport.width;
            offscreen.height = viewport.height;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise;
            preloadCache[pageNum] = offscreen;
        } catch (_) { /* silent — preload opsional */ }
    }
}

function showError(message) {
    const loader     = document.getElementById('loader-container');
    const loaderText = document.getElementById('loader-text');

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

window.flipPrev = () => $flipbook?.turn('previous');
window.flipNext = () => $flipbook?.turn('next');