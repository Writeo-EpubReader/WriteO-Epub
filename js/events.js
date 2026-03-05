/* ── js/events.js ── Event binding, file handling, keyboard ── */
'use strict';

// ── Container visibility helper ───────────────────────────────
// Called any time we need to sync container display to State.mode
function applyContainerVisibility() {
    const mode = State.mode;
    const showScroll = (mode === 'scroll' || mode === 'continuous');
    DOM.scrollContainer.style.display = showScroll ? '' : 'none';
    DOM.bookContainer.style.display = (mode === 'book') ? '' : 'none';
    DOM.chapterNav.style.display = (mode !== 'continuous') ? '' : 'none';
    DOM.scrollContainer.classList.toggle('continuous-mode', mode === 'continuous');
    log('events', 'Container visibility applied for mode:', mode);
}

// ── Event binding ─────────────────────────────────────────────
function bindEvents() {
    // File inputs
    DOM.fileInput.addEventListener('change', onFileSelected);
    DOM.fileInputReader.addEventListener('change', onFileSelected);

    // Navigation
    DOM.homeBtn.addEventListener('click', goHome);
    DOM.prevChapterBtn.addEventListener('click', () => loadChapter(State.currentChapter - 1));
    DOM.nextChapterBtn.addEventListener('click', () => loadChapter(State.currentChapter + 1));
    DOM.prevPageBtn.addEventListener('click', () => turnPage(-1));
    DOM.nextPageBtn.addEventListener('click', () => turnPage(1));

    // Panels
    DOM.tocBtn.addEventListener('click', () => togglePanel('toc'));
    DOM.tocClose.addEventListener('click', () => closePanel('toc'));
    DOM.tocOverlay.addEventListener('click', () => closePanel('toc'));
    DOM.settingsBtn.addEventListener('click', () => togglePanel('settings'));
    DOM.settingsClose.addEventListener('click', () => closePanel('settings'));
    DOM.settingsOverlay.addEventListener('click', () => closePanel('settings'));

    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabEl = document.getElementById('tab-' + btn.dataset.tab);
            if (tabEl) tabEl.classList.add('active');
        });
    });

    // Reading modes
    DOM.modeScroll.addEventListener('click', () => setMode('scroll'));
    DOM.modeContinuous.addEventListener('click', () => setMode('continuous'));
    DOM.modeBook.addEventListener('click', () => setMode('book'));

    // Bookmark + fullscreen
    DOM.bookmarkBtn.addEventListener('click', addManualBookmark);
    DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Preset themes
    document.querySelectorAll('.theme-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            State.theme = btn.dataset.theme;
            applySettings();
            saveSettings();
        });
    });

    // Custom theme
    DOM.applyCustomTheme.addEventListener('click', () => {
        State.theme = 'theme-custom';
        applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);
        applySettings();
        saveSettings();
        showToast('🎨 Custom theme applied!');
    });

    const colorBindings = [
        ['customBg', 'customBgHex'], ['customText', 'customTextHex'],
        ['customSurface', 'customSurfaceHex'], ['customAccent', 'customAccentHex'],
        ['customMuted', 'customMutedHex'],
    ];
    colorBindings.forEach(([key, hexKey]) => {
        const picker = DOM[key], hexEl = DOM[hexKey];
        if (!picker || !hexEl) return;
        picker.addEventListener('input', () => {
            State[key] = picker.value; hexEl.value = picker.value;
            applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);
            updatePreview();
            if (State.theme === 'theme-custom') saveSettings();
        });
        hexEl.addEventListener('input', () => {
            const val = hexEl.value.startsWith('#') ? hexEl.value : '#' + hexEl.value;
            if (isValidHex(val)) {
                State[key] = val; picker.value = val;
                applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);
                updatePreview();
                if (State.theme === 'theme-custom') saveSettings();
            }
        });
    });

    DOM.resetSettingsBtn.addEventListener('click', resetSettings);

    // Fonts
    document.querySelectorAll('.font-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            State.font = btn.dataset.font;
            document.documentElement.style.setProperty('--font-family', `'${State.font}'`);
            document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.dataset.font === State.font));
            saveSettings();
        });
    });

    // Font weight
    document.querySelectorAll('[data-weight]').forEach(btn => {
        btn.addEventListener('click', () => {
            State.fontWeight = parseInt(btn.dataset.weight);
            document.documentElement.style.setProperty('--font-weight', State.fontWeight);
            document.querySelectorAll('[data-weight]').forEach(b =>
                b.classList.toggle('active', parseInt(b.dataset.weight) === State.fontWeight));
            if (DOM.fontWeightDisplay) DOM.fontWeightDisplay.textContent = WEIGHT_LABELS[State.fontWeight] || 'Normal';
            saveSettings();
        });
    });

    // Sliders
    const sliderMap = [
        [DOM.fontSizeSlider, DOM.fontSizeDisplay, v => { State.fontSize = parseInt(v); return v + 'px'; }, '--font-size', v => v + 'px'],
        [DOM.lineHeightSlider, DOM.lineHeightDisplay, v => { State.lineHeight = parseFloat(v); return v; }, '--line-height', v => v],
        [DOM.contentWidthSlider, DOM.contentWidthDisplay, v => { State.contentWidth = parseInt(v); return v + 'px'; }, '--content-width', v => v + 'px'],
        [DOM.letterSpacingSlider, DOM.letterSpacingDisplay, v => { State.letterSpacing = parseFloat(v); return v + 'px'; }, '--letter-spacing', v => v + 'px'],
        [DOM.wordSpacingSlider, DOM.wordSpacingDisplay, v => { State.wordSpacing = parseFloat(v); return v + 'px'; }, '--word-spacing', v => v + 'px'],
        [DOM.paraSpacingSlider, DOM.paraSpacingDisplay, v => { State.paraSpacing = parseFloat(v); return v + 'em'; }, '--para-spacing', v => v + 'em'],
        [DOM.brightnessSlider, DOM.brightnessDisplay, v => { State.brightness = parseInt(v); return v + '%'; }, '--reader-brightness', v => v / 100],
    ];
    sliderMap.forEach(([slider, display, stateFn, cssVar, cssValFn]) => {
        if (!slider) return;
        slider.addEventListener('input', e => {
            const label = stateFn(e.target.value);
            if (display) display.textContent = label;
            document.documentElement.style.setProperty(cssVar, cssValFn(e.target.value));
            saveSettings();
        });
    });

    // Toggle switches
    [
        [DOM.smoothScrollToggle, 'smoothScroll', v => { DOM.scrollContainer.style.scrollBehavior = v ? 'smooth' : 'auto'; }],
        [DOM.textIndentToggle, 'textIndent', v => document.documentElement.style.setProperty('--text-indent', v ? '2em' : '0')],
        [DOM.justifyToggle, 'justify', v => document.documentElement.style.setProperty('--text-align', v ? 'justify' : 'left')],
        [DOM.italicToggle, 'italic', v => document.documentElement.style.setProperty('--font-style', v ? 'italic' : 'normal')],
    ].forEach(([el, key, fn]) => {
        if (!el) return;
        el.addEventListener('change', e => { State[key] = e.target.checked; fn(e.target.checked); saveSettings(); });
    });

    // Page speed
    document.querySelectorAll('[data-speed]').forEach(btn => {
        btn.addEventListener('click', () => {
            State.pageSpeed = btn.dataset.speed;
            document.documentElement.style.setProperty('--page-speed', PAGE_SPEED_MS[State.pageSpeed] + 'ms');
            document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', b.dataset.speed === State.pageSpeed));
            saveSettings();
        });
    });

    // Bookmarks
    DOM.clearBookmarksBtn.addEventListener('click', clearAllBookmarks);

    // Scroll tracking
    DOM.scrollContainer.addEventListener('scroll', onScrollEvent, { passive: true });

    // Drag & drop
    document.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    document.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.epub')) handleEpubFile(file);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    log('events', 'All events bound');
}

// ── File handling ─────────────────────────────────────────────
function onFileSelected(e) {
    const file = e.target.files[0];
    if (file) {
        log('events', 'File selected:', { name: file.name, size: file.size });
        handleEpubFile(file);
    }
    e.target.value = '';
}

async function handleEpubFile(file) {
    log('events', '▶ handleEpubFile start', { name: file.name, size: file.size });
    showLoading('Parsing EPUB…');

    try {
        // ── Parse ──────────────────────────────────────────────────
        const epub = await parseEpub(file);
        log('events', 'EPUB parsed', { title: epub.title, chapters: epub.chapters.length, toc: epub.toc.length });

        // ── State — reset book-specific fields before loading new book
        State.book = epub;
        State.bookTitle = epub.title || file.name.replace(/\.epub$/i, '');
        // FIX: Use full btoa string (no truncation) to avoid key collisions
        State.bookId = 'bk_' + _stableHash(file.name + '|' + file.size);
        State.chapters = epub.chapters;
        State.toc = epub.toc;
        State.currentChapter = 0;
        State.currentPage = 0;
        State.pages = [];
        log('events', 'Book ID:', State.bookId);

        // Tear down any running continuous reader
        if (State.continuousReader) {
            State.continuousReader.destroy();
            State.continuousReader = null;
            log('events', 'Previous continuous reader destroyed');
        }

        // Load bookmarks for THIS book
        State.bookmarks = loadBookmarks();
        log('events', 'Bookmarks loaded for this book:', State.bookmarks.length);
        saveRecentBook({ id: State.bookId, title: State.bookTitle, lastChapter: 0 });

        // Show reader UI FIRST so containers are laid out (clientHeight > 0 for book pagination)
        showReader();
        // NOW sync container visibility — reader-screen is visible so heights are measurable
        applyContainerVisibility();
        buildToc();
        renderBookmarksList();

        // ── Resume position ───────────────────────────────────────
        const saved = loadAutoBookmark();
        log('events', 'Auto-bookmark for this book:', saved);

        if (State.mode === 'continuous') {
            log('events', 'Initialising continuous reader');
            State.continuousReader = createVirtualContinuousReader(DOM.scrollContainer, DOM.scrollContent);
            State.continuousReader.init(saved ? Math.min(saved.chapterIndex || 0, State.chapters.length - 1) : 0);
            if (saved) showToast('📖 Resumed from where you left off');

        } else if (saved && saved.chapterIndex >= 0 && saved.chapterIndex < State.chapters.length) {
            log('events', 'Resuming at chapter', saved.chapterIndex);
            await loadChapter(saved.chapterIndex, false);
            if (State.mode === 'scroll') {
                requestAnimationFrame(() => { DOM.scrollContainer.scrollTop = saved.scrollY || 0; });
            } else if (State.mode === 'book') {
                State.currentPage = saved.page || 0;
                displayPage();
            }
            showToast('📖 Resumed from where you left off');

        } else {
            log('events', 'No valid bookmark — loading chapter 0');
            await loadChapter(0);
        }

        log('events', '✅ Book loaded successfully');

    } catch (err) {
        logError('events', 'handleEpubFile failed', err);
        showToast('❌ Failed to read EPUB: ' + err.message);
    } finally {
        hideLoading();
    }
}

// ── Stable hash to generate a collision-resistant bookId ──────
function _stableHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;  // FNV-1a, 32-bit, unsigned
    }
    return h.toString(16).padStart(8, '0');
}

// ── Keyboard shortcuts ─────────────────────────────────────────
function onKeyDown(e) {
    if (!State.book) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
        case 'ArrowRight': case 'PageDown':
            e.preventDefault();
            if (State.mode === 'book') turnPage(1);
            else if (State.mode === 'scroll') loadChapter(State.currentChapter + 1);
            break;
        case 'ArrowLeft': case 'PageUp':
            e.preventDefault();
            if (State.mode === 'book') turnPage(-1);
            else if (State.mode === 'scroll') loadChapter(State.currentChapter - 1);
            break;
        case 'f': case 'F': if (!e.ctrlKey) toggleFullscreen(); break;
        case 'b': case 'B': if (!e.ctrlKey) addManualBookmark(); break;
        case 't': case 'T': if (!e.ctrlKey) togglePanel('toc'); break;
        case 'Escape': closePanel('settings'); closePanel('toc'); break;
    }
}
