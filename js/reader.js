/* ── js/reader.js ── All three reading modes ─────────────────
   Modes:
     scroll     – chapter-by-chapter with prev/next        (existing)
     book       – paginated with slide animation           (existing)
     continuous – virtualized infinite scroll              (NEW)
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
// CHAPTER LOADER  (entry point for all modes)
// ═══════════════════════════════════════════════════════════════
async function loadChapter(index, saveAuto = true) {
    if (!State.chapters.length) { logWarn('reader', 'loadChapter called but no chapters'); return; }
    index = Math.max(0, Math.min(index, State.chapters.length - 1));
    State.currentChapter = index;

    const chapter = State.chapters[index];
    if (!chapter) { logError('reader', 'Chapter not found at index', index); return; }
    log('reader', `Loading chapter ${index}: "${chapter.title}" (mode: ${State.mode})`);

    if (State.mode === 'scroll') {
        DOM.scrollContent.innerHTML = chapter.content;
        fixLinks(DOM.scrollContent);
        DOM.scrollContainer.scrollTop = 0;
        log('reader', 'Chapter rendered to scroll-content, length:', chapter.content.length);
    } else if (State.mode === 'book') {
        await repaginateAndShow();
    }
    // continuous mode is handled entirely inside VirtualContinuousReader

    updateNav();
    updateProgress();
    highlightTocItem(index);
    if (saveAuto) saveAutoBookmark();
}

// ── Mode switcher ─────────────────────────────────────────────
async function setMode(mode) {
    if (State.mode === mode) return;
    log('reader', 'setMode:', mode);

    // Tear down current continuous reader if leaving that mode
    if (State.mode === 'continuous' && State.continuousReader) {
        State.continuousReader.destroy();
        State.continuousReader = null;
    }

    State.mode = mode;
    saveSettings();
    applySettings();

    // Show/hide containers
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
        State.continuousReader = createVirtualContinuousReader(DOM.scrollContainer, DOM.scrollContent);
        State.continuousReader.init(State.currentChapter);
    }
}

// ═══════════════════════════════════════════════════════════════
// SCROLL MODE
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
// CONTINUOUS MODE  –  VirtualContinuousReader
// ═══════════════════════════════════════════════════════════════
function createVirtualContinuousReader(scrollContainer, contentEl) {

    const chapters = State.chapters;
    const chapterHeights = new Array(chapters.length).fill(0);  // measured heights
    let renderedStart = 0;
    let renderedEnd = -1;
    let topSpacer = null;
    let bottomSpacer = null;
    let destroyed = false;
    const SCROLL_DEBOUNCE = 80;    // ms
    const LOAD_BUFFER = 1200;  // px from edge before loading next chunk

    // ── Public API ───────────────────────────────────────────────
    function init(startChapter = 0) {
        destroyed = false;
        contentEl.innerHTML = '';
        contentEl.style.display = '';
        scrollContainer.classList.add('continuous-mode');

        topSpacer = _spacer('top-spacer');
        contentEl.appendChild(topSpacer);

        bottomSpacer = _spacer('bottom-spacer');
        contentEl.appendChild(bottomSpacer);

        State.currentChapter = startChapter;
        const winStart = Math.max(0, startChapter - VIRTUAL_WINDOW);
        const winEnd = Math.min(chapters.length - 1, startChapter + VIRTUAL_WINDOW);

        for (let i = winStart; i <= winEnd; i++) _appendChapter(i);
        renderedStart = winStart;
        renderedEnd = winEnd;

        _updateSpacers();
        scrollContainer.addEventListener('scroll', _onScrollDebounced, { passive: true });

        // Scroll to the start chapter
        requestAnimationFrame(() => {
            const target = contentEl.querySelector(`[data-chapter="${startChapter}"]`);
            if (target) scrollContainer.scrollTop = target.offsetTop - contentEl.offsetTop;
        });
    }

    function destroy() {
        destroyed = true;
        scrollContainer.removeEventListener('scroll', _onScrollDebounced);
        scrollContainer.classList.remove('continuous-mode');
        contentEl.innerHTML = '';
    }

    function scrollToChapter(index) {
        const el = contentEl.querySelector(`[data-chapter="${index}"]`);
        if (el) {
            scrollContainer.scrollTop = el.offsetTop - contentEl.offsetTop;
        } else {
            // chapter not in DOM, re-init at that chapter
            destroy();
            destroyed = false;
            init(index);
        }
    }

    // ── Scroll handler ───────────────────────────────────────────
    let _scrollTimer = null;
    function _onScrollDebounced() {
        if (destroyed) return;
        clearTimeout(_scrollTimer);
        _scrollTimer = setTimeout(_onScroll, SCROLL_DEBOUNCE);
    }

    function _onScroll() {
        if (destroyed) return;
        _detectCurrentChapter();
        _expandIfNeeded();
        _collapseIfNeeded();
        updateProgress();
        clearTimeout(_onScroll._auto);
        _onScroll._auto = setTimeout(saveAutoBookmark, 600);
    }

    // ── Which chapter is visible? ────────────────────────────────
    function _detectCurrentChapter() {
        const scrollTop = scrollContainer.scrollTop;
        const viewCenter = scrollTop + scrollContainer.clientHeight * 0.35;
        const blocks = contentEl.querySelectorAll('[data-chapter]');
        let current = State.currentChapter;

        for (const el of blocks) {
            const top = el.offsetTop - contentEl.offsetTop;
            if (top <= viewCenter) current = parseInt(el.dataset.chapter);
            else break;
        }

        if (current !== State.currentChapter) {
            State.currentChapter = current;
            updateNav();
            highlightTocItem(current);
        }
    }

    // ── Expand window when approaching edges ─────────────────────
    function _expandIfNeeded() {
        const scrollTop = scrollContainer.scrollTop;
        const scrollBottom = scrollTop + scrollContainer.clientHeight;
        const topSpacerH = topSpacer ? (parseFloat(topSpacer.style.height) || 0) : 0;
        const totalH = contentEl.scrollHeight;

        // Near top → add chapter above
        if (scrollTop - topSpacerH < LOAD_BUFFER && renderedStart > 0) {
            _prependChapter(renderedStart - 1);
            renderedStart--;
            _updateSpacers();
        }
        // Near bottom → add chapter below
        if (totalH - scrollBottom < LOAD_BUFFER && renderedEnd < chapters.length - 1) {
            _appendChapter(renderedEnd + 1);
            renderedEnd++;
            _updateSpacers();
        }
    }

    // ── Collapse chapters far from view ──────────────────────────
    function _collapseIfNeeded() {
        const scrollTop = scrollContainer.scrollTop;
        const scrollBottom = scrollTop + scrollContainer.clientHeight;

        // Remove chapters too far above
        while (renderedStart < State.currentChapter - VIRTUAL_WINDOW) {
            _removeTopChapter();
        }
        // Remove chapters too far below
        while (renderedEnd > State.currentChapter + VIRTUAL_WINDOW) {
            _removeBottomChapter();
        }
    }

    // ── DOM manipulation helpers ──────────────────────────────────

    // Append a chapter block before the bottom spacer
    function _appendChapter(index) {
        const el = _makeChapterEl(index);
        contentEl.insertBefore(el, bottomSpacer);
        // Measure & store height
        chapterHeights[index] = el.offsetHeight || ESTIMATED_CHAPTER_HEIGHT;
    }

    // Prepend a chapter block after the top spacer — adjust scrollTop to prevent jump
    function _prependChapter(index) {
        const el = _makeChapterEl(index);
        const firstChapter = contentEl.querySelector('[data-chapter]');
        contentEl.insertBefore(el, firstChapter);

        const h = el.offsetHeight || ESTIMATED_CHAPTER_HEIGHT;
        chapterHeights[index] = h;
        // Prevent scroll jump: new content was added above viewport
        scrollContainer.scrollTop += h;
    }

    // Remove the topmost rendered chapter
    function _removeTopChapter() {
        const el = contentEl.querySelector(`[data-chapter="${renderedStart}"]`);
        if (!el) { renderedStart++; return; }
        const h = el.offsetHeight;
        chapterHeights[renderedStart] = h;
        // Adjust scrollTop because content above the viewport shrinks
        scrollContainer.scrollTop -= h;
        el.remove();
        renderedStart++;
        _updateSpacers();
    }

    // Remove the bottommost rendered chapter
    function _removeBottomChapter() {
        const el = contentEl.querySelector(`[data-chapter="${renderedEnd}"]`);
        if (!el) { renderedEnd--; return; }
        chapterHeights[renderedEnd] = el.offsetHeight;
        el.remove();
        renderedEnd--;
        _updateSpacers();
    }

    // Recalculate spacer heights
    function _updateSpacers() {
        let topH = 0;
        for (let i = 0; i < renderedStart; i++) {
            topH += chapterHeights[i] || ESTIMATED_CHAPTER_HEIGHT;
        }
        let botH = 0;
        for (let i = renderedEnd + 1; i < chapters.length; i++) {
            botH += chapterHeights[i] || ESTIMATED_CHAPTER_HEIGHT;
        }
        if (topSpacer) topSpacer.style.height = topH + 'px';
        if (bottomSpacer) bottomSpacer.style.height = botH + 'px';
    }

    // Build the chapter DOM element
    function _makeChapterEl(index) {
        const c = chapters[index];
        const div = document.createElement('div');
        div.className = 'chapter-block reader-content';
        div.dataset.chapter = index;
        div.innerHTML = `
      <div class="chapter-divider">
        <span class="chapter-divider-label">${c.title || 'Chapter ' + (index + 1)}</span>
      </div>
      ${c.content}`;
        fixLinks(div);
        return div;
    }

    function _spacer(cls) {
        const div = document.createElement('div');
        div.className = `virtual-spacer ${cls}`;
        div.style.height = '0px';
        return div;
    }

    return { init, destroy, scrollToChapter };
}
