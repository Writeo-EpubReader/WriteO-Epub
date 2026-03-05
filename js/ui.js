/* ── js/ui.js ── Panels, TOC, toast, progress, fullscreen ─── */
'use strict';

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 2800);
}

// ── Loading overlay ───────────────────────────────────────────
function showLoading(msg) {
    if (DOM.loadingText) DOM.loadingText.textContent = msg || 'Loading…';
    if (DOM.loadingOverlay) DOM.loadingOverlay.style.display = '';
}
function updateLoadingText(msg) {
    if (DOM.loadingText) DOM.loadingText.textContent = msg;
}
function hideLoading() {
    if (DOM.loadingOverlay) DOM.loadingOverlay.style.display = 'none';
}

// ── Screen switching ──────────────────────────────────────────
function showReader() {
    DOM.welcomeScreen.style.display = 'none';
    DOM.readerScreen.style.display = '';
    DOM.bookTitle.textContent = State.bookTitle;
    document.title = State.bookTitle + ' — WriteO Epub Reader';
    initAutoHideBar();
}

function goHome() {
    if (State.continuousReader) { State.continuousReader.destroy(); State.continuousReader = null; }
    DOM.welcomeScreen.style.display = '';
    DOM.readerScreen.style.display = 'none';
    document.title = 'WriteO Epub Reader';
    closePanel('settings');
    closePanel('toc');
    loadRecentBooks();
    stopAutoHideBar();
}

// ── Side panels ───────────────────────────────────────────────
function togglePanel(name) {
    const panel = name === 'toc' ? DOM.tocPanel : DOM.settingsPanel;
    panel.classList.contains('open') ? closePanel(name) : openPanel(name);
}
function openPanel(name) {
    const panel = name === 'toc' ? DOM.tocPanel : DOM.settingsPanel;
    const overlay = name === 'toc' ? DOM.tocOverlay : DOM.settingsOverlay;
    panel.classList.add('open');
    overlay.style.display = '';
    // Bar should stay visible while a panel is open
    _showBar();
    clearTimeout(_barHideTimer);
}
function closePanel(name) {
    const panel = name === 'toc' ? DOM.tocPanel : DOM.settingsPanel;
    const overlay = name === 'toc' ? DOM.tocOverlay : DOM.settingsOverlay;
    panel.classList.remove('open');
    overlay.style.display = 'none';
    // Resume auto-hide when panel is closed
    _scheduleHideBar();
}

// ── Auto-hide top bar ─────────────────────────────────────────
let _barHideTimer = null;
let _barHideActive = false;

function initAutoHideBar() {
    if (_barHideActive) return;
    _barHideActive = true;
    _scheduleHideBar();
    document.addEventListener('mousemove', _onBarMouseMove, { passive: true });
    document.addEventListener('touchstart', _onBarTouch, { passive: true });
}

function stopAutoHideBar() {
    _barHideActive = false;
    clearTimeout(_barHideTimer);
    _showBar();
    document.removeEventListener('mousemove', _onBarMouseMove);
    document.removeEventListener('touchstart', _onBarTouch);
}

function _onBarMouseMove(e) {
    if (!_barHideActive) return;
    if (e.clientY < 80) _showBar();
    _scheduleHideBar();
}
function _onBarTouch() {
    if (!_barHideActive) return;
    _showBar(); _scheduleHideBar();
}
function _scheduleHideBar() {
    if (!_barHideActive) return;
    clearTimeout(_barHideTimer);
    if (!DOM.settingsPanel || !DOM.tocPanel) return;
    if (DOM.settingsPanel.classList.contains('open') || DOM.tocPanel.classList.contains('open')) return;
    _barHideTimer = setTimeout(_hideBar, 3000);
}
function _showBar() {
    if (DOM.topBar) DOM.topBar.classList.remove('hidden');
    const track = document.getElementById('progress-bar-track');
    if (track) track.classList.remove('bar-hidden');
}
function _hideBar() {
    if (!_barHideActive) return;
    if (DOM.settingsPanel && DOM.settingsPanel.classList.contains('open')) return;
    if (DOM.tocPanel && DOM.tocPanel.classList.contains('open')) return;
    if (DOM.topBar) DOM.topBar.classList.add('hidden');
    const track = document.getElementById('progress-bar-track');
    if (track) track.classList.add('bar-hidden');
}

// ── Table of Contents ─────────────────────────────────────────
function buildToc() {
    DOM.tocList.innerHTML = '';
    const entries = State.toc.length
        ? State.toc
        : State.chapters.map((c, i) => ({ title: c.title, chapterIndex: i, level: 1 }));

    entries.forEach((entry, i) => {
        const btn = document.createElement('button');
        btn.className = `toc-item level-${Math.min(entry.level || 1, 3)}`;
        btn.textContent = entry.title || `Chapter ${i + 1}`;
        btn.addEventListener('click', () => {
            const idx = entry.chapterIndex !== undefined ? entry.chapterIndex : i;
            loadChapter(idx);
            closePanel('toc');
        });
        DOM.tocList.appendChild(btn);
    });
}

function highlightTocItem(chapterIndex) {
    const entries = State.toc.length
        ? State.toc
        : State.chapters.map((_, j) => ({ chapterIndex: j }));
    document.querySelectorAll('.toc-item').forEach((btn, i) => {
        btn.classList.toggle('active', entries[i] && entries[i].chapterIndex === chapterIndex);
    });
}

// ── Chapter nav & progress ────────────────────────────────────
function updateNav() {
    const ch = State.currentChapter, total = State.chapters.length;
    if (DOM.prevChapterBtn) DOM.prevChapterBtn.disabled = ch === 0;
    if (DOM.nextChapterBtn) DOM.nextChapterBtn.disabled = ch === total - 1;
    if (DOM.chapterIndicator) DOM.chapterIndicator.textContent = `Chapter ${ch + 1} of ${total}`;
}

function updateProgress() {
    if (!State.chapters.length) return;
    let pct = 0;

    if (State.mode === 'continuous') {
        // In continuous mode use the overall scroll position within total content
        const el = DOM.scrollContainer;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 0) pct = (el.scrollTop / max) * 100;
    } else if (State.mode === 'scroll') {
        const el = DOM.scrollContainer;
        const max = el.scrollHeight - el.clientHeight;
        const chProgress = max > 0 ? el.scrollTop / max : 0;
        pct = ((State.currentChapter + chProgress) / State.chapters.length) * 100;
    } else {
        pct = ((State.currentChapter * 10 + State.currentPage) / (State.chapters.length * 10)) * 100;
    }

    pct = Math.min(100, Math.max(0, pct));
    if (DOM.progressFill) DOM.progressFill.style.width = pct.toFixed(1) + '%';
    if (DOM.progressDisplay) DOM.progressDisplay.textContent = Math.round(pct) + '%';
}

// ── Fullscreen ────────────────────────────────────────────────
function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
    else document.exitFullscreen().catch(() => { });
}

function onFullscreenChange() {
    const isFs = !!document.fullscreenElement;
    if (!DOM.fullscreenBtn) return;
    DOM.fullscreenBtn.innerHTML = isFs
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    if (isFs) showToast('⛶ Fullscreen — hover top/bottom for controls');
}
