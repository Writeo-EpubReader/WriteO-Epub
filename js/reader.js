/* ── js/reader.js ── All three reading modes ─────────────────
   Modes:
     scroll     – chapter-by-chapter with prev/next
     book       – paginated with slide animation
     continuous – simple append-on-demand (no virtualization)
   ──────────────────────────────────────────────────────────── */
'use strict';

// ── Shared link fixer ─────────────────────────────────────────
function fixLinks(container) {
    container.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('data:')) {
            a.addEventListener('click', e => {
                e.preventDefault();
                const base = href.split('#')[0];
                const idx = State.chapters.findIndex(c => {
                    const ch = c.href.split('#')[0];
                    return ch.endsWith(base) || decodeURIComponent(ch).endsWith(decodeURIComponent(base));
                });
                if (idx !== -1) loadChapter(idx);
            });
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// CHAPTER LOADER  (entry point for scroll & book modes)
// ═══════════════════════════════════════════════════════════════
async function loadChapter(index, saveAuto = true) {
    if (!State.chapters.length) { logWarn('reader', 'loadChapter called but no chapters'); return; }
    index = Math.max(0, Math.min(index, State.chapters.length - 1));
    State.currentChapter = index;

    const chapter = State.chapters[index];
    if (!chapter) { logError('reader', 'Chapter not found at index', index); return; }
    log('reader', `Loading chapter ${index}: "${chapter.title}" (mode: ${State.mode})`);

    if (State.mode === 'scroll') {
        // Temporarily disable smooth scroll so the jump to top is instant, not animated
        const prevBehavior = DOM.scrollContainer.style.scrollBehavior;
        DOM.scrollContainer.style.scrollBehavior = 'auto';

        // Fade-out → swap content → fade-in
        DOM.scrollContent.classList.add('chapter-exit');
        await new Promise(r => setTimeout(r, 160));

        DOM.scrollContent.innerHTML = chapter.content;
        fixLinks(DOM.scrollContent);
        DOM.scrollContainer.scrollTop = 0;
        DOM.scrollContent.classList.remove('chapter-exit');
        DOM.scrollContent.classList.add('chapter-enter');
        DOM.scrollContent.addEventListener('animationend', () => {
            DOM.scrollContent.classList.remove('chapter-enter');
        }, { once: true });

        requestAnimationFrame(() => { DOM.scrollContainer.style.scrollBehavior = prevBehavior; });

    } else if (State.mode === 'book') {
        await repaginateAndShow();
    }
    // continuous mode is managed entirely by the continuous reader instance

    updateNav();
    updateProgress();
    highlightTocItem(index);
    if (saveAuto) saveAutoBookmark();
}

// ── Mode switcher ─────────────────────────────────────────────
async function setMode(mode) {
    if (State.mode === mode) return;
    log('reader', 'setMode:', mode);

    if (State.mode === 'continuous' && State.continuousReader) {
        State.continuousReader.destroy();
        State.continuousReader = null;
    }

    State.mode = mode;
    saveSettings();
    applySettings();

    const showScroll = (mode === 'scroll' || mode === 'continuous');
    DOM.scrollContainer.style.display = showScroll ? '' : 'none';
    DOM.bookContainer.style.display = mode === 'book' ? '' : 'none';
    DOM.chapterNav.style.display = mode !== 'continuous' ? '' : 'none';
    DOM.scrollContainer.classList.toggle('continuous-mode', mode === 'continuous');

    if (mode === 'scroll') {
        loadChapter(State.currentChapter, false);
    } else if (mode === 'book') {
        await repaginateAndShow();
    } else if (mode === 'continuous') {
        State.continuousReader = createContinuousReader(DOM.scrollContainer, DOM.scrollContent);
        State.continuousReader.init(State.currentChapter);
    }
}

// ═══════════════════════════════════════════════════════════════
// SCROLL MODE – scroll event
// ═══════════════════════════════════════════════════════════════
function onScrollEvent() {
    updateProgress();
    clearTimeout(onScrollEvent._t);
    onScrollEvent._t = setTimeout(saveAutoBookmark, 600);
}

// ═══════════════════════════════════════════════════════════════
// BOOK MODE  (paginated)
// ═══════════════════════════════════════════════════════════════
async function repaginateAndShow() {
    const chapter = State.chapters[State.currentChapter];
    if (!chapter) return;

    const measure = document.createElement('div');
    measure.className = 'book-page reader-content';
    Object.assign(measure.style, {
        position: 'absolute', visibility: 'hidden', top: '0', left: '0',
        width: State.contentWidth + 'px',
        fontSize: State.fontSize + 'px',
        lineHeight: State.lineHeight,
        padding: '2.5rem',
    });
    measure.innerHTML = chapter.content;
    document.body.appendChild(measure);

    const pageH = DOM.bookContent.clientHeight || 600;
    State.pages = chunkByHeight(chapter.content, measure, pageH);
    document.body.removeChild(measure);

    State.currentPage = 0;
    displayPage();
}

function chunkByHeight(html, el, maxH) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const children = Array.from(doc.body.children);
    el.innerHTML = '';
    const pages = [];

    for (const child of children) {
        el.appendChild(child.cloneNode(true));
        if (el.scrollHeight > maxH && el.children.length > 1) {
            const saved = [...el.children].slice(0, -1).map(c => c.outerHTML).join('');
            pages.push(saved);
            el.innerHTML = el.lastElementChild ? el.lastElementChild.outerHTML : '';
        }
    }
    if (el.innerHTML.trim()) pages.push(el.innerHTML);
    return pages.length ? pages : [html];
}

function displayPage() {
    if (!State.pages.length) { logWarn('reader', 'displayPage: no pages'); return; }
    log('reader', `Displaying page ${State.currentPage + 1} of ${State.pages.length}`);
    DOM.bookContent.innerHTML = State.pages[State.currentPage] || State.pages[0];
    fixLinks(DOM.bookContent);
    DOM.prevPageBtn.disabled = State.currentPage === 0 && State.currentChapter === 0;
    DOM.nextPageBtn.disabled = State.currentPage === State.pages.length - 1 && State.currentChapter === State.chapters.length - 1;
    updateProgress();
    saveAutoBookmark();
}

function turnPage(dir) {
    const [outClass, inClass] = dir > 0
        ? ['page-turn-out-left', 'page-turn-in-right']
        : ['page-turn-out-right', 'page-turn-in-left'];
    const speed = PAGE_SPEED_MS[State.pageSpeed];

    DOM.bookContent.classList.add(outClass);
    setTimeout(() => {
        DOM.bookContent.classList.remove(outClass);
        if (dir > 0) {
            if (State.currentPage < State.pages.length - 1) { State.currentPage++; displayPage(); }
            else if (State.currentChapter < State.chapters.length - 1) {
                loadChapter(State.currentChapter + 1).then(() => { State.currentPage = 0; displayPage(); }); return;
            }
        } else {
            if (State.currentPage > 0) { State.currentPage--; displayPage(); }
            else if (State.currentChapter > 0) {
                loadChapter(State.currentChapter - 1).then(() => { State.currentPage = State.pages.length - 1; displayPage(); }); return;
            }
        }
        DOM.bookContent.classList.add(inClass);
        setTimeout(() => DOM.bookContent.classList.remove(inClass), speed);
    }, speed);
}

// ═══════════════════════════════════════════════════════════════
// CONTINUOUS MODE  – simple append-on-demand reader
// ═══════════════════════════════════════════════════════════════
function createContinuousReader(scrollContainer, contentEl) {

    const chapters = State.chapters;
    let loadedUpTo = -1;   // index of the last chapter appended to DOM
    let destroyed = false;
    let _scrollTimer = null;
    let _loading = false;  // debounce guard while appending

    const SCROLL_DEBOUNCE = 80;   // ms
    const LOAD_BUFFER = 1400; // px from bottom before we load next chapter

    // ── Public API ───────────────────────────────────────────────
    function init(startChapter = 0) {
        destroyed = false;
        contentEl.innerHTML = '';
        contentEl.style.display = '';
        scrollContainer.classList.add('continuous-mode');
        loadedUpTo = -1;
        _loading = false;

        // Pre-load from chapter 0 up to startChapter + a small look-ahead
        const preloadEnd = Math.min(startChapter + 2, chapters.length - 1);
        for (let i = 0; i <= preloadEnd; i++) _appendChapter(i);
        loadedUpTo = preloadEnd;

        scrollContainer.addEventListener('scroll', _onScrollDebounced, { passive: true });

        // Scroll to startChapter after two frames (layout must settle first)
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const target = contentEl.querySelector(`[data-chapter="${startChapter}"]`);
            if (target) {
                scrollContainer.scrollTop = target.offsetTop;
            }
        }));
    }

    function destroy() {
        destroyed = true;
        clearTimeout(_scrollTimer);
        scrollContainer.removeEventListener('scroll', _onScrollDebounced);
        scrollContainer.classList.remove('continuous-mode');
        contentEl.innerHTML = '';
        loadedUpTo = -1;
    }

    function scrollToChapter(index) {
        // Ensure all chapters up to the requested one are loaded
        if (index > loadedUpTo) {
            for (let i = loadedUpTo + 1; i <= Math.min(index, chapters.length - 1); i++) {
                _appendChapter(i);
            }
            loadedUpTo = Math.min(index, chapters.length - 1);
        }
        const el = contentEl.querySelector(`[data-chapter="${index}"]`);
        if (el) scrollContainer.scrollTop = el.offsetTop;
    }

    // ── Scroll handler ───────────────────────────────────────────
    function _onScrollDebounced() {
        if (destroyed) return;
        clearTimeout(_scrollTimer);
        _scrollTimer = setTimeout(_onScroll, SCROLL_DEBOUNCE);
    }

    function _onScroll() {
        if (destroyed) return;
        _detectCurrentChapter();
        _expandIfNeeded();
        updateProgress();
        clearTimeout(_onScroll._auto);
        _onScroll._auto = setTimeout(saveAutoBookmark, 600);
    }

    // ── Which chapter is currently in view? ──────────────────────
    function _detectCurrentChapter() {
        const scrollTop = scrollContainer.scrollTop;
        const viewCentre = scrollTop + scrollContainer.clientHeight * 0.35;
        const blocks = contentEl.querySelectorAll('[data-chapter]');
        let current = State.currentChapter;

        for (const el of blocks) {
            if (el.offsetTop <= viewCentre) current = parseInt(el.dataset.chapter);
            else break;
        }

        if (current !== State.currentChapter) {
            State.currentChapter = current;
            updateNav();
            highlightTocItem(current);
        }
    }

    // ── Append next chapter when near the bottom ─────────────────
    function _expandIfNeeded() {
        if (_loading) return;
        if (loadedUpTo >= chapters.length - 1) return; // all chapters loaded

        const distanceFromBottom = scrollContainer.scrollHeight
            - scrollContainer.scrollTop
            - scrollContainer.clientHeight;

        if (distanceFromBottom < LOAD_BUFFER) {
            _loading = true;
            _appendChapter(loadedUpTo + 1);
            loadedUpTo++;
            _loading = false;
        }
    }

    // ── Build & insert a chapter element ─────────────────────────
    function _appendChapter(index) {
        const c = chapters[index];
        if (!c) return;
        const div = document.createElement('div');
        div.className = 'chapter-block reader-content';
        div.dataset.chapter = index;
        div.innerHTML = `
            <div class="chapter-divider">
                <span class="chapter-divider-label">${c.title || 'Chapter ' + (index + 1)}</span>
            </div>
            ${c.content}`;
        fixLinks(div);
        contentEl.appendChild(div);
    }

    return { init, destroy, scrollToChapter };
}
