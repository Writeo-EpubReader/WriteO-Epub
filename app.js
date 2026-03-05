/**
 * ============================================================
 * LUMINA READER — app.js  (v3 — IndexedDB persistence, auto-hide bar, WriteO modal)
 * ============================================================
 */

'use strict';

// ─── INDEXEDDB ───────────────────────────────────────────────
const IDB_NAME = 'writeo_epub_db';
const IDB_STORE = 'books';
const IDB_VERSION = 1;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

function openBookDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function saveBookToIDB(id, file) {
  try {
    const db = await openBookDB();
    const buf = await file.arrayBuffer();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ buf, name: file.name, size: file.size }, id);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) { console.warn('IDB save failed:', e); }
}

async function loadBookFromIDB(id) {
  try {
    const db = await openBookDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => {
        if (!req.result) return resolve(null);
        const { buf, name } = req.result;
        resolve(new File([buf], name, { type: 'application/epub+zip' }));
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

async function clearBookFromIDB(id) {
  try {
    const db = await openBookDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
  } catch (e) { console.warn('IDB clear failed:', e); }
}

async function getAllStoredBookIds() {
  try {
    const db = await openBookDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) { return []; }
}

// ─── STATE ──────────────────────────────────────────────────
const State = {
  book: null,
  chapters: [],
  currentChapter: 0,
  currentPage: 0,
  pages: [],
  mode: 'scroll',
  theme: 'theme-dark',
  fontSize: 18,
  lineHeight: 1.7,
  contentWidth: 680,
  font: 'Lora',
  fontWeight: 400,
  letterSpacing: 0,
  paraSpacing: 1,
  textIndent: false,
  justify: false,
  italic: false,
  wordSpacing: 0,
  smoothScroll: true,
  pageSpeed: 'fast',
  brightness: 100,
  // Custom theme colours
  customBg: '#12121e',
  customText: '#e0e0f0',
  customSurface: '#1c1c30',
  customAccent: '#7C3AED',
  customMuted: '#8888aa',
  bookTitle: '',
  bookId: '',
  bookmarks: [],
  toc: [],
};

const PAGE_SPEED_MS = { fast: 200, medium: 350, slow: 550 };
const WEIGHT_LABELS = { 300: 'Light', 400: 'Normal', 500: 'Medium', 600: 'Semibold', 700: 'Bold' };

// ─── DOM REFS ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const DOM = {
  body: document.body,
  welcomeScreen: $('welcome-screen'),
  readerScreen: $('reader-screen'),
  fileInput: $('file-input'),
  fileInputReader: $('file-input-reader'),
  homeBtn: $('home-btn'),
  tocBtn: $('toc-btn'),
  tocPanel: $('toc-panel'),
  tocClose: $('toc-close'),
  tocOverlay: $('toc-overlay'),
  tocList: $('toc-list'),
  settingsBtn: $('settings-btn'),
  settingsPanel: $('settings-panel'),
  settingsClose: $('settings-close'),
  settingsOverlay: $('settings-overlay'),
  bookmarkBtn: $('bookmark-btn'),
  fullscreenBtn: $('fullscreen-btn'),
  bookTitle: $('book-title-display'),
  progressDisplay: $('progress-display'),
  progressFill: $('progress-bar-fill'),
  scrollContainer: $('scroll-container'),
  scrollContent: $('scroll-content'),
  bookContainer: $('book-container'),
  bookContent: $('book-content'),
  prevPageBtn: $('prev-page-btn'),
  nextPageBtn: $('next-page-btn'),
  prevChapterBtn: $('prev-chapter-btn'),
  nextChapterBtn: $('next-chapter-btn'),
  chapterIndicator: $('chapter-indicator'),
  chapterNav: $('chapter-nav'),
  modeScroll: $('mode-scroll'),
  modeBook: $('mode-book'),
  fontSizeSlider: $('font-size-slider'),
  fontSizeDisplay: $('font-size-display'),
  lineHeightSlider: $('line-height-slider'),
  lineHeightDisplay: $('line-height-display'),
  contentWidthSlider: $('content-width-slider'),
  contentWidthDisplay: $('content-width-display'),
  letterSpacingSlider: $('letter-spacing-slider'),
  letterSpacingDisplay: $('letter-spacing-display'),
  wordSpacingSlider: $('word-spacing-slider'),
  wordSpacingDisplay: $('word-spacing-display'),
  paraSpacingSlider: $('para-spacing-slider'),
  paraSpacingDisplay: $('para-spacing-display'),
  fontWeightDisplay: $('font-weight-display'),
  smoothScrollToggle: $('smooth-scroll-toggle'),
  textIndentToggle: $('text-indent-toggle'),
  justifyToggle: $('justify-toggle'),
  italicToggle: $('italic-toggle'),
  brightnessSlider: $('brightness-slider'),
  brightnessDisplay: $('brightness-display'),
  bookmarksList: $('bookmarks-list'),
  clearBookmarksBtn: $('clear-bookmarks-btn'),
  recentBooksSection: $('recent-books-section'),
  recentBooksList: $('recent-books-list'),
  toast: $('toast'),
  loadingOverlay: $('loading-overlay'),
  loadingText: $('loading-text'),
  applyCustomTheme: $('apply-custom-theme'),
  resetSettingsBtn: $('reset-settings-btn'),
  themePreview: $('theme-preview'),
  customBg: $('custom-bg'),
  customBgHex: $('custom-bg-hex'),
  customText: $('custom-text'),
  customTextHex: $('custom-text-hex'),
  customSurface: $('custom-surface'),
  customSurfaceHex: $('custom-surface-hex'),
  customAccent: $('custom-accent'),
  customAccentHex: $('custom-accent-hex'),
  customMuted: $('custom-muted'),
  customMutedHex: $('custom-muted-hex'),
};

// ─── INIT ───────────────────────────────────────────────────
(function init() {
  loadSettings();
  applySettings();
  loadRecentBooks();
  restoreLastBook();
  bindEvents();
})();

async function restoreLastBook() {
  const ids = await getAllStoredBookIds();
  if (!ids.length) return;
  // Use the most recently stored key (last item)
  const lastId = ids[ids.length - 1];
  const stored = JSON.parse(localStorage.getItem('last_stored_book') || 'null');
  if (!stored) return;
  // Show a restore button in the welcome screen
  showRestoreBookBanner(stored.title, stored.id);
}

function showRestoreBookBanner(title, bookId) {
  const section = DOM.recentBooksSection;
  // Add restore button above recent list
  let restoreCard = document.getElementById('restore-stored-book');
  if (!restoreCard) {
    restoreCard = document.createElement('button');
    restoreCard.id = 'restore-stored-book';
    restoreCard.className = 'restore-book-banner';
    restoreCard.innerHTML = `
      <span class="restore-icon">📚</span>
      <span class="restore-info">
        <span class="restore-title"></span>
        <span class="restore-sub">Click to resume (stored in browser)</span>
      </span>
      <span class="restore-arrow">→</span>
    `;
    DOM.welcomeScreen.querySelector('.welcome-actions').appendChild(restoreCard);
  }
  restoreCard.querySelector('.restore-title').textContent = title;
  restoreCard.style.display = 'flex';
  restoreCard.onclick = async () => {
    restoreCard.style.opacity = '0.6';
    restoreCard.style.pointerEvents = 'none';
    const file = await loadBookFromIDB(bookId);
    if (file) {
      handleEpubFile(file);
    } else {
      showToast('❌ Could not restore book — please reload it manually.');
      restoreCard.remove();
    }
  };
  section.style.display = '';
}

// ─── SETTINGS PERSISTENCE ───────────────────────────────────
const DEFAULTS = {
  theme: 'theme-dark', fontSize: 18, lineHeight: 1.7, contentWidth: 680,
  font: 'Lora', fontWeight: 400, letterSpacing: 0, paraSpacing: 1,
  textIndent: false, justify: false, italic: false,
  wordSpacing: 0,
  smoothScroll: true, pageSpeed: 'fast', mode: 'scroll', brightness: 100,
  customBg: '#12121e', customText: '#e0e0f0', customSurface: '#1c1c30',
  customAccent: '#7C3AED', customMuted: '#8888aa',
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('lumina_settings') || '{}');
    Object.keys(DEFAULTS).forEach(k => {
      if (k in s) State[k] = s[k];
    });
  } catch (e) { }
}

function saveSettings() {
  const data = {};
  Object.keys(DEFAULTS).forEach(k => data[k] = State[k]);
  localStorage.setItem('lumina_settings', JSON.stringify(data));
}

function resetSettings() {
  Object.assign(State, { ...DEFAULTS });
  saveSettings();
  applySettings();
  // Reset custom colour inputs to match defaults
  syncCustomColorInputs();
  showToast('↺ Settings reset to defaults');
}

// ─── APPLY SETTINGS → DOM + CSS vars ────────────────────────
function applySettings() {
  // Theme class
  DOM.body.className = State.theme;
  document.querySelectorAll('.theme-swatch').forEach(el =>
    el.classList.toggle('active', el.dataset.theme === State.theme)
  );

  // CSS variables
  const root = document.documentElement.style;
  root.setProperty('--font-size', State.fontSize + 'px');
  root.setProperty('--line-height', State.lineHeight);
  root.setProperty('--content-width', State.contentWidth + 'px');
  root.setProperty('--font-family', `'${State.font}'`);
  root.setProperty('--font-weight', State.fontWeight);
  root.setProperty('--letter-spacing', State.letterSpacing + 'px');
  root.setProperty('--word-spacing', State.wordSpacing + 'px');
  root.setProperty('--para-spacing', State.paraSpacing + 'em');
  root.setProperty('--text-indent', State.textIndent ? '2em' : '0');
  root.setProperty('--text-align', State.justify ? 'justify' : 'left');
  root.setProperty('--font-style', State.italic ? 'italic' : 'normal');
  root.setProperty('--page-speed', PAGE_SPEED_MS[State.pageSpeed] + 'ms');
  root.setProperty('--reader-brightness', State.brightness / 100);

  // Apply custom theme vars regardless so they are ready when selected
  applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);

  // Smooth scroll
  DOM.scrollContainer.style.scrollBehavior = State.smoothScroll ? 'smooth' : 'auto';

  // Sliders
  DOM.fontSizeSlider.value = State.fontSize;
  DOM.fontSizeDisplay.textContent = State.fontSize + 'px';
  DOM.lineHeightSlider.value = State.lineHeight;
  DOM.lineHeightDisplay.textContent = State.lineHeight;
  DOM.contentWidthSlider.value = State.contentWidth;
  DOM.contentWidthDisplay.textContent = State.contentWidth + 'px';
  DOM.letterSpacingSlider.value = State.letterSpacing;
  DOM.letterSpacingDisplay.textContent = State.letterSpacing + 'px';
  DOM.wordSpacingSlider.value = State.wordSpacing;
  DOM.wordSpacingDisplay.textContent = State.wordSpacing + 'px';
  DOM.paraSpacingSlider.value = State.paraSpacing;
  DOM.paraSpacingDisplay.textContent = State.paraSpacing + 'em';
  DOM.brightnessSlider.value = State.brightness;
  DOM.brightnessDisplay.textContent = State.brightness + '%';

  // Toggles
  DOM.smoothScrollToggle.checked = State.smoothScroll;
  DOM.textIndentToggle.checked = State.textIndent;
  DOM.justifyToggle.checked = State.justify;
  DOM.italicToggle.checked = State.italic;

  // Font buttons
  document.querySelectorAll('.font-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.font === State.font)
  );

  // Font weight buttons
  DOM.fontWeightDisplay.textContent = WEIGHT_LABELS[State.fontWeight] || 'Normal';
  document.querySelectorAll('[data-weight]').forEach(btn =>
    btn.classList.toggle('active', parseInt(btn.dataset.weight) === State.fontWeight)
  );

  // Mode buttons
  DOM.modeScroll.classList.toggle('active', State.mode === 'scroll');
  DOM.modeBook.classList.toggle('active', State.mode === 'book');

  // Speed buttons
  document.querySelectorAll('[data-speed]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.speed === State.pageSpeed)
  );

  // Sync custom colour inputs with saved values
  syncCustomColorInputs();
  updatePreview();
}

// ─── CUSTOM THEME ────────────────────────────────────────────
function applyCustomCSSVars(bg, text, surface, accent, muted) {
  const root = document.documentElement.style;
  root.setProperty('--custom-bg', bg);
  root.setProperty('--custom-text', text);
  root.setProperty('--custom-surface', surface);
  root.setProperty('--custom-surface2', lightenHex(surface, 8));
  root.setProperty('--custom-border', hexToRgba(text, 0.08));
  root.setProperty('--custom-accent', accent);
  root.setProperty('--custom-muted', muted);
}

function syncCustomColorInputs() {
  const pairs = [
    [DOM.customBg, DOM.customBgHex, State.customBg],
    [DOM.customText, DOM.customTextHex, State.customText],
    [DOM.customSurface, DOM.customSurfaceHex, State.customSurface],
    [DOM.customAccent, DOM.customAccentHex, State.customAccent],
    [DOM.customMuted, DOM.customMutedHex, State.customMuted],
  ];
  pairs.forEach(([picker, hex, val]) => {
    picker.value = val;
    hex.value = val;
  });
}

function updatePreview() {
  const bg = State.customBg;
  const text = State.customText;
  const accent = State.customAccent;
  const surface = State.customSurface;
  DOM.themePreview.style.background = surface;
  DOM.themePreview.querySelector('.preview-body-text').style.color = text;
  DOM.themePreview.querySelector('.preview-accent-text').style.color = accent;
  DOM.themePreview.style.borderColor = hexToRgba(text, 0.1);
}

// Colour helpers
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function lightenHex(hex, pct) {
  let r = parseInt(hex.slice(1, 3), 16) + pct;
  let g = parseInt(hex.slice(3, 5), 16) + pct;
  let b = parseInt(hex.slice(5, 7), 16) + pct;
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
function isValidHex(h) { return /^#[0-9a-fA-F]{6}$/.test(h); }

// ─── EVENTS ─────────────────────────────────────────────────
function bindEvents() {
  // File inputs
  DOM.fileInput.addEventListener('change', onFileSelected);
  DOM.fileInputReader.addEventListener('change', onFileSelected);

  // Home
  DOM.homeBtn.addEventListener('click', goHome);

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
      const tab = $('tab-' + btn.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });

  // Bookmark + fullscreen
  DOM.bookmarkBtn.addEventListener('click', addManualBookmark);
  DOM.fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // Reading mode
  DOM.modeScroll.addEventListener('click', () => setMode('scroll'));
  DOM.modeBook.addEventListener('click', () => setMode('book'));

  // Preset themes
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      State.theme = btn.dataset.theme;
      applySettings();
      saveSettings();
    });
  });

  // Custom theme apply
  DOM.applyCustomTheme.addEventListener('click', () => {
    State.theme = 'theme-custom';
    applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);
    applySettings();
    saveSettings();
    showToast('🎨 Custom theme applied!');
  });

  // Reset settings
  DOM.resetSettingsBtn.addEventListener('click', resetSettings);

  // Color pickers — bidirectional sync between native picker & hex input
  const colorBindings = [
    ['customBg', DOM.customBg, DOM.customBgHex],
    ['customText', DOM.customText, DOM.customTextHex],
    ['customSurface', DOM.customSurface, DOM.customSurfaceHex],
    ['customAccent', DOM.customAccent, DOM.customAccentHex],
    ['customMuted', DOM.customMuted, DOM.customMutedHex],
  ];
  colorBindings.forEach(([key, picker, hexEl]) => {
    picker.addEventListener('input', () => {
      State[key] = picker.value;
      hexEl.value = picker.value;
      applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);
      updatePreview();
      if (State.theme === 'theme-custom') saveSettings();
    });
    hexEl.addEventListener('input', () => {
      const val = hexEl.value.startsWith('#') ? hexEl.value : '#' + hexEl.value;
      if (isValidHex(val)) {
        State[key] = val;
        picker.value = val;
        applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);
        updatePreview();
        if (State.theme === 'theme-custom') saveSettings();
      }
    });
  });

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
      document.querySelectorAll('[data-weight]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.weight) === State.fontWeight));
      DOM.fontWeightDisplay.textContent = WEIGHT_LABELS[State.fontWeight] || 'Normal';
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
    slider.addEventListener('input', e => {
      const label = stateFn(e.target.value);
      display.textContent = label;
      document.documentElement.style.setProperty(cssVar, cssValFn(e.target.value));
      if (cssVar === '--content-width' && State.mode === 'book' && State.pages.length) repaginateAndShow();
      saveSettings();
    });
  });

  // Toggle switches
  DOM.smoothScrollToggle.addEventListener('change', e => {
    State.smoothScroll = e.target.checked;
    DOM.scrollContainer.style.scrollBehavior = State.smoothScroll ? 'smooth' : 'auto';
    saveSettings();
  });
  DOM.textIndentToggle.addEventListener('change', e => {
    State.textIndent = e.target.checked;
    document.documentElement.style.setProperty('--text-indent', State.textIndent ? '2em' : '0');
    saveSettings();
  });
  DOM.justifyToggle.addEventListener('change', e => {
    State.justify = e.target.checked;
    document.documentElement.style.setProperty('--text-align', State.justify ? 'justify' : 'left');
    saveSettings();
  });
  DOM.italicToggle.addEventListener('change', e => {
    State.italic = e.target.checked;
    document.documentElement.style.setProperty('--font-style', State.italic ? 'italic' : 'normal');
    saveSettings();
  });

  // Speed buttons
  document.querySelectorAll('[data-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      State.pageSpeed = btn.dataset.speed;
      document.documentElement.style.setProperty('--page-speed', PAGE_SPEED_MS[State.pageSpeed] + 'ms');
      document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', b.dataset.speed === State.pageSpeed));
      saveSettings();
    });
  });

  // Book-mode page buttons
  DOM.prevPageBtn.addEventListener('click', () => turnPage(-1));
  DOM.nextPageBtn.addEventListener('click', () => turnPage(1));

  // Chapter navigation
  DOM.prevChapterBtn.addEventListener('click', () => loadChapter(State.currentChapter - 1));
  DOM.nextChapterBtn.addEventListener('click', () => loadChapter(State.currentChapter + 1));

  // Scroll tracking
  DOM.scrollContainer.addEventListener('scroll', onScroll, { passive: true });

  // Bookmarks
  DOM.clearBookmarksBtn.addEventListener('click', clearAllBookmarks);

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown);

  // Drag & drop
  document.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.epub')) handleEpubFile(file);
  });
}

// ─── KEYBOARD SHORTCUTS ────────────────────────────────────
function onKeyDown(e) {
  if (!State.book) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown':
      e.preventDefault();
      (State.mode === 'book') ? turnPage(1) : loadChapter(State.currentChapter + 1);
      break;
    case 'ArrowLeft': case 'PageUp':
      e.preventDefault();
      (State.mode === 'book') ? turnPage(-1) : loadChapter(State.currentChapter - 1);
      break;
    case 'f': case 'F': if (!e.ctrlKey) toggleFullscreen(); break;
    case 'b': case 'B': if (!e.ctrlKey) addManualBookmark(); break;
    case 'Escape': closePanel('settings'); closePanel('toc'); break;
    case 't': case 'T': if (!e.ctrlKey) togglePanel('toc'); break;
  }
}

// ─── FILE HANDLING ───────────────────────────────────────────
function onFileSelected(e) {
  const file = e.target.files[0];
  if (file) handleEpubFile(file);
  e.target.value = '';
}

async function handleEpubFile(file) {
  // 50 MB limit for storage (we still allow reading larger files but skip saving)
  const willStore = file.size <= MAX_FILE_BYTES;
  showLoading('Parsing EPUB…');
  try {
    const epub = await parseEpub(file);
    State.book = epub;
    State.bookTitle = epub.title || file.name.replace('.epub', '');
    State.bookId = 'book_' + btoa(encodeURIComponent(file.name + file.size)).slice(0, 20);
    State.chapters = epub.chapters;
    State.toc = epub.toc;
    State.bookmarks = loadBookmarks();

    saveRecentBook({ id: State.bookId, title: State.bookTitle, lastChapter: 0 });

    // Persist to IndexedDB
    if (willStore) {
      await saveBookToIDB(State.bookId, file);
      localStorage.setItem('last_stored_book', JSON.stringify({ id: State.bookId, title: State.bookTitle }));
    } else {
      showToast('⚠️ Book is over 50 MB — it won\'t be saved for offline use, but you can still read it.');
    }

    showReader();
    buildToc();
    renderBookmarksList();

    const saved = loadAutoBookmark();
    if (saved) {
      await loadChapter(saved.chapterIndex || 0, false);
      if (State.mode === 'scroll') {
        requestAnimationFrame(() => { DOM.scrollContainer.scrollTop = saved.scrollY || 0; });
      } else {
        State.currentPage = saved.page || 0;
        displayPage();
      }
      showToast('📖 Resumed from where you left off');
    } else {
      await loadChapter(0);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Failed to read EPUB: ' + err.message);
  } finally {
    hideLoading();
  }
}

// ─── EPUB PARSER ─────────────────────────────────────────────
async function parseEpub(file) {
  const zip = await JSZip.loadAsync(file);
  const containerXml = await zip.file('META-INF/container.xml').async('string');
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
  const opfPath = containerDoc.querySelector('rootfile').getAttribute('full-path');
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  const opfXml = await zip.file(opfPath).async('string');
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

  const title = (opfDoc.querySelector('metadata title, dc\\:title, *|title') || {}).textContent || 'Unknown Title';

  const manifest = {};
  opfDoc.querySelectorAll('manifest item').forEach(item => {
    manifest[item.getAttribute('id')] = {
      href: item.getAttribute('href'),
      mediaType: item.getAttribute('media-type'),
    };
  });

  const spineItems = [];
  opfDoc.querySelectorAll('spine itemref').forEach(ref => {
    const id = ref.getAttribute('idref');
    if (manifest[id] && manifest[id].mediaType === 'application/xhtml+xml') {
      spineItems.push({ id, href: opfDir + manifest[id].href });
    }
  });

  let toc = [];
  const navId = opfDoc.querySelector('manifest item[properties~="nav"]');
  if (navId) {
    const navHref = opfDir + navId.getAttribute('href');
    const navFile = zip.file(navHref) || zip.file(decodeURIComponent(navHref));
    if (navFile) {
      const navHtml = await navFile.async('string');
      toc = parsNavToc(new DOMParser().parseFromString(navHtml, 'text/html'), opfDir);
    }
  }
  if (!toc.length) {
    const ncxItem = Object.values(manifest).find(m => m.mediaType === 'application/x-dtbncx+xml');
    if (ncxItem) {
      const ncxFile = zip.file(opfDir + ncxItem.href) || zip.file(ncxItem.href);
      if (ncxFile) {
        const ncxXml = await ncxFile.async('string');
        toc = parseNcxToc(new DOMParser().parseFromString(ncxXml, 'application/xml'), opfDir);
      }
    }
  }

  const chapters = [];
  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    updateLoadingText(`Loading chapters… (${i + 1}/${spineItems.length})`);
    const file2 = zip.file(item.href) || zip.file(decodeURIComponent(item.href));
    if (!file2) continue;
    let html = await file2.async('string');
    html = await resolveResources(html, zip, item.href, opfDir);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const h1 = doc.querySelector('h1,h2,h3,title');
    chapters.push({
      id: item.id, href: item.href,
      title: h1 ? h1.textContent.trim() : `Chapter ${i + 1}`,
      content: sanitizeHtml(doc.body ? doc.body.innerHTML : html),
    });
  }

  toc.forEach(entry => {
    const idx = chapters.findIndex(c => {
      const chH = c.href.split('#')[0];
      const tH = entry.href.split('#')[0];
      return chH.endsWith(tH) || tH.endsWith(chH) ||
        decodeURIComponent(chH).endsWith(decodeURIComponent(tH));
    });
    if (idx !== -1) entry.chapterIndex = idx;
  });

  return { title, chapters, toc };
}

function parsNavToc(doc, dir) {
  return [...doc.querySelectorAll('nav a')].map(a => ({
    title: a.textContent.trim(), href: a.getAttribute('href'), level: 1,
  }));
}

function parseNcxToc(doc, dir) {
  const toc = [];
  function walk(nodes, level) {
    nodes.forEach(node => {
      const label = node.querySelector('navLabel text');
      const content = node.querySelector('content');
      if (label && content) toc.push({ title: label.textContent.trim(), href: content.getAttribute('src'), level });
      walk(node.querySelectorAll(':scope > navPoint'), level + 1);
    });
  }
  walk(doc.querySelectorAll('navMap > navPoint'), 1);
  return toc;
}

async function resolveResources(html, zip, chapterHref, opfDir) {
  const chapterDir = chapterHref.includes('/') ? chapterHref.substring(0, chapterHref.lastIndexOf('/') + 1) : '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    try {
      const resolved = resolveHref(chapterDir, src);
      const imgFile = zip.file(resolved) || zip.file(decodeURIComponent(resolved));
      if (imgFile) {
        const b64 = await imgFile.async('base64');
        img.setAttribute('src', `data:${guessMime(resolved)};base64,${b64}`);
      }
    } catch (e) { }
  }
  return doc.documentElement.outerHTML;
}

function resolveHref(base, href) {
  if (href.startsWith('/')) return href.slice(1);
  const parts = (base + href).split('/'), resolved = [];
  for (const p of parts) { if (p === '..') resolved.pop(); else if (p !== '.') resolved.push(p); }
  return resolved.join('/');
}
function guessMime(href) {
  const ext = href.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'image/jpeg';
}
function sanitizeHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '').replace(/on\w+='[^']*'/gi, '');
}

// ─── SCREENS ─────────────────────────────────────────────────
function showReader() {
  DOM.welcomeScreen.style.display = 'none';
  DOM.readerScreen.style.display = '';
  DOM.bookTitle.textContent = State.bookTitle;
  document.title = State.bookTitle + ' — WriteO Epub Reader';
  initAutoHideBar();
}
function goHome() {
  DOM.welcomeScreen.style.display = '';
  DOM.readerScreen.style.display = 'none';
  document.title = 'WriteO Epub Reader';
  closePanel('settings'); closePanel('toc');
  loadRecentBooks();
  stopAutoHideBar();
}

// ─── AUTO-HIDE TOP BAR ───────────────────────────────────────
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
  // Always show bar when mouse is near the top
  if (e.clientY < 80) {
    _showBar();
  }
  _scheduleHideBar();
}

function _onBarTouch() {
  if (!_barHideActive) return;
  _showBar();
  _scheduleHideBar();
}

function _scheduleHideBar() {
  clearTimeout(_barHideTimer);
  // Don't hide if a panel is open
  if (DOM.settingsPanel.classList.contains('open') || DOM.tocPanel.classList.contains('open')) return;
  _barHideTimer = setTimeout(_hideBar, 3000);
}

function _showBar() {
  DOM.topBar.classList.remove('hidden');
  document.getElementById('progress-bar-track').classList.remove('bar-hidden');
}

function _hideBar() {
  if (DOM.settingsPanel.classList.contains('open') || DOM.tocPanel.classList.contains('open')) return;
  DOM.topBar.classList.add('hidden');
  document.getElementById('progress-bar-track').classList.add('bar-hidden');
}

// ─── CHAPTERS ────────────────────────────────────────────────
async function loadChapter(index, saveAuto = true) {
  if (!State.chapters.length) return;
  index = Math.max(0, Math.min(index, State.chapters.length - 1));
  State.currentChapter = index;
  const chapter = State.chapters[index];
  if (!chapter) return;
  if (State.mode === 'scroll') {
    DOM.scrollContent.innerHTML = chapter.content;
    fixLinks(DOM.scrollContent);
    DOM.scrollContainer.scrollTop = 0;
  } else {
    await repaginateAndShow();
  }
  updateNav(); updateProgress(); highlightTocItem(index);
  if (saveAuto) saveAutoBookmark();
}

function fixLinks(container) {
  container.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('http') && !href.startsWith('data:')) {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = href.split('#')[0];
        const idx = State.chapters.findIndex(c => c.href.endsWith(target) || decodeURIComponent(c.href).endsWith(decodeURIComponent(target)));
        if (idx !== -1) loadChapter(idx);
      });
    }
  });
}

// ─── BOOK MODE ───────────────────────────────────────────────
async function repaginateAndShow() {
  const chapter = State.chapters[State.currentChapter];
  if (!chapter) return;
  const measure = document.createElement('div');
  measure.className = 'book-page reader-content';
  measure.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;width:${State.contentWidth}px;font-size:${State.fontSize}px;line-height:${State.lineHeight};padding:2.5rem;`;
  measure.innerHTML = chapter.content;
  document.body.appendChild(measure);
  const pageHeight = DOM.bookContent.clientHeight || 600;
  State.pages = chunkContentByHeight(chapter.content, measure, pageHeight);
  document.body.removeChild(measure);
  State.currentPage = 0;
  displayPage();
}

function chunkContentByHeight(html, measureEl, maxHeight) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const children = Array.from(doc.body.children);
  measureEl.innerHTML = '';
  const pages = [];
  for (const child of children) {
    measureEl.appendChild(child.cloneNode(true));
    if (measureEl.scrollHeight > maxHeight && pages.length >= 0) {
      const saved = [...measureEl.children].slice(0, -1).map(c => c.outerHTML).join('');
      if (saved) { pages.push(saved); measureEl.innerHTML = measureEl.lastElementChild ? measureEl.lastElementChild.outerHTML : ''; }
    }
  }
  if (measureEl.innerHTML.trim()) pages.push(measureEl.innerHTML);
  return pages.length ? pages : [html];
}

function displayPage() {
  if (!State.pages.length) return;
  DOM.bookContent.innerHTML = State.pages[State.currentPage] || State.pages[0];
  fixLinks(DOM.bookContent);
  DOM.prevPageBtn.disabled = State.currentPage === 0 && State.currentChapter === 0;
  DOM.nextPageBtn.disabled = State.currentPage === State.pages.length - 1 && State.currentChapter === State.chapters.length - 1;
  updateProgress(); saveAutoBookmark();
}

function turnPage(dir) {
  const anim = dir > 0 ? ['page-turn-out-left', 'page-turn-in-right'] : ['page-turn-out-right', 'page-turn-in-left'];
  DOM.bookContent.classList.add(anim[0]);
  const speed = PAGE_SPEED_MS[State.pageSpeed];
  setTimeout(() => {
    DOM.bookContent.classList.remove(anim[0]);
    if (dir > 0) {
      if (State.currentPage < State.pages.length - 1) { State.currentPage++; displayPage(); }
      else if (State.currentChapter < State.chapters.length - 1) { loadChapter(State.currentChapter + 1).then(() => { State.currentPage = 0; displayPage(); }); return; }
    } else {
      if (State.currentPage > 0) { State.currentPage--; displayPage(); }
      else if (State.currentChapter > 0) { loadChapter(State.currentChapter - 1).then(() => { State.currentPage = State.pages.length - 1; displayPage(); }); return; }
    }
    DOM.bookContent.classList.add(anim[1]);
    setTimeout(() => DOM.bookContent.classList.remove(anim[1]), speed);
  }, speed);
}

async function setMode(mode) {
  if (State.mode === mode) return;
  State.mode = mode;
  saveSettings(); applySettings();
  if (mode === 'scroll') {
    DOM.bookContainer.style.display = 'none';
    DOM.scrollContainer.style.display = '';
    DOM.chapterNav.style.display = '';
    loadChapter(State.currentChapter, false);
  } else {
    DOM.scrollContainer.style.display = 'none';
    DOM.bookContainer.style.display = '';
    DOM.chapterNav.style.display = 'none';
    await repaginateAndShow();
  }
}

// ─── TOC ─────────────────────────────────────────────────────
function buildToc() {
  DOM.tocList.innerHTML = '';
  const entries = State.toc.length ? State.toc : State.chapters.map((c, i) => ({ title: c.title, chapterIndex: i, level: 1 }));
  entries.forEach((entry, i) => {
    const btn = document.createElement('button');
    btn.className = `toc-item level-${Math.min(entry.level || 1, 3)}`;
    btn.textContent = entry.title || `Chapter ${i + 1}`;
    btn.addEventListener('click', () => { loadChapter(entry.chapterIndex !== undefined ? entry.chapterIndex : i); closePanel('toc'); });
    DOM.tocList.appendChild(btn);
  });
}
function highlightTocItem(idx) {
  const entries = State.toc.length ? State.toc : State.chapters.map((_, j) => ({ chapterIndex: j }));
  document.querySelectorAll('.toc-item').forEach((btn, i) => {
    btn.classList.toggle('active', entries[i] && entries[i].chapterIndex === idx);
  });
}

// ─── NAV & PROGRESS ──────────────────────────────────────────
function updateNav() {
  const ch = State.currentChapter, total = State.chapters.length;
  DOM.prevChapterBtn.disabled = ch === 0;
  DOM.nextChapterBtn.disabled = ch === total - 1;
  DOM.chapterIndicator.textContent = `Chapter ${ch + 1} of ${total}`;
}
function updateProgress() {
  let progress = 0;
  if (State.mode === 'scroll') {
    const el = DOM.scrollContainer, max = el.scrollHeight - el.clientHeight;
    progress = ((State.currentChapter + (max > 0 ? el.scrollTop / max : 0)) / State.chapters.length) * 100;
  } else {
    progress = ((State.currentChapter * 10 + State.currentPage) / (State.chapters.length * 10)) * 100;
  }
  progress = Math.min(100, Math.max(0, progress));
  DOM.progressFill.style.width = progress.toFixed(1) + '%';
  DOM.progressDisplay.textContent = Math.round(progress) + '%';
}
function onScroll() {
  updateProgress();
  clearTimeout(onScroll._t);
  onScroll._t = setTimeout(saveAutoBookmark, 600);
}

// ─── BOOKMARKS ───────────────────────────────────────────────
function getBookmarksKey() { return State.bookId + '_bookmarks'; }
function getAutoKey() { return State.bookId + '_auto'; }

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(getBookmarksKey()) || '[]'); } catch (e) { return []; }
}
function saveBookmarks() { localStorage.setItem(getBookmarksKey(), JSON.stringify(State.bookmarks)); }

function saveAutoBookmark() {
  if (!State.bookId) return;
  localStorage.setItem(getAutoKey(), JSON.stringify({
    chapterIndex: State.currentChapter,
    scrollY: DOM.scrollContainer.scrollTop,
    page: State.currentPage,
    timestamp: Date.now(),
  }));
  saveRecentBook({ id: State.bookId, title: State.bookTitle, lastChapter: State.currentChapter });
}
function loadAutoBookmark() {
  try { return JSON.parse(localStorage.getItem(getAutoKey()) || 'null'); } catch (e) { return null; }
}

function addManualBookmark() {
  const chapter = State.chapters[State.currentChapter];
  State.bookmarks.push({
    id: Date.now(),
    chapterIndex: State.currentChapter,
    chapterTitle: chapter ? chapter.title : `Chapter ${State.currentChapter + 1}`,
    scrollY: DOM.scrollContainer.scrollTop,
    page: State.currentPage,
    timestamp: Date.now(),
  });
  saveBookmarks(); renderBookmarksList();
  showToast('🔖 Bookmark added');
  DOM.bookmarkBtn.classList.add('active');
  setTimeout(() => DOM.bookmarkBtn.classList.remove('active'), 1000);
}
function goToBookmark(bm) {
  loadChapter(bm.chapterIndex, false).then(() => {
    if (State.mode === 'scroll') requestAnimationFrame(() => { DOM.scrollContainer.scrollTop = bm.scrollY || 0; });
    else { State.currentPage = bm.page || 0; displayPage(); }
  });
  closePanel('settings');
}
function deleteBookmark(id) { State.bookmarks = State.bookmarks.filter(b => b.id !== id); saveBookmarks(); renderBookmarksList(); }
function clearAllBookmarks() { State.bookmarks = []; saveBookmarks(); renderBookmarksList(); showToast('🗑️ Bookmarks cleared'); }

function renderBookmarksList() {
  if (!State.bookmarks.length) {
    DOM.bookmarksList.innerHTML = '<p class="empty-state">No bookmarks yet. Press <b>B</b> or 🔖 to add one.</p>';
    return;
  }
  DOM.bookmarksList.innerHTML = '';
  [...State.bookmarks].reverse().forEach(bm => {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    const d = new Date(bm.timestamp);
    item.innerHTML = `<div class="bookmark-item-info"><span>${bm.chapterTitle}</span><small>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><button class="bookmark-delete" title="Delete">✕</button>`;
    item.querySelector('.bookmark-item-info').addEventListener('click', () => goToBookmark(bm));
    item.querySelector('.bookmark-delete').addEventListener('click', () => deleteBookmark(bm.id));
    DOM.bookmarksList.appendChild(item);
  });
}

// ─── RECENT BOOKS ─────────────────────────────────────────────
function saveRecentBook(info) {
  try {
    let r = JSON.parse(localStorage.getItem('lumina_recents') || '[]');
    r = r.filter(x => x.id !== info.id);
    r.unshift(info);
    localStorage.setItem('lumina_recents', JSON.stringify(r.slice(0, 5)));
  } catch (e) { }
}
function loadRecentBooks() {
  try {
    const r = JSON.parse(localStorage.getItem('lumina_recents') || '[]');
    if (!r.length) { DOM.recentBooksSection.style.display = 'none'; return; }
    DOM.recentBooksSection.style.display = '';
    DOM.recentBooksList.innerHTML = '';
    r.forEach(book => {
      const btn = document.createElement('button');
      btn.className = 'recent-book-item';
      btn.innerHTML = `<span class="recent-book-icon">📖</span><div class="recent-book-info"><h4>${book.title || 'Unknown'}</h4><p>Chapter ${(book.lastChapter || 0) + 1} · Auto-saved</p></div>`;
      btn.addEventListener('click', () => { showToast('Re-open the EPUB file to continue.'); DOM.fileInput.click(); });
      DOM.recentBooksList.appendChild(btn);
    });
  } catch (e) { DOM.recentBooksSection.style.display = 'none'; }
}

// ─── PANELS ──────────────────────────────────────────────────
function togglePanel(name) { const p = name === 'toc' ? DOM.tocPanel : DOM.settingsPanel; p.classList.contains('open') ? closePanel(name) : openPanel(name); }
function openPanel(name) {
  const panel = name === 'toc' ? DOM.tocPanel : DOM.settingsPanel;
  const overlay = name === 'toc' ? DOM.tocOverlay : DOM.settingsOverlay;
  panel.classList.add('open'); overlay.style.display = '';
}
function closePanel(name) {
  const panel = name === 'toc' ? DOM.tocPanel : DOM.settingsPanel;
  const overlay = name === 'toc' ? DOM.tocOverlay : DOM.settingsOverlay;
  panel.classList.remove('open'); overlay.style.display = 'none';
}

// ─── FULLSCREEN ───────────────────────────────────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
  else document.exitFullscreen().catch(() => { });
}
function onFullscreenChange() {
  const isFs = !!document.fullscreenElement;
  DOM.fullscreenBtn.innerHTML = isFs
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  if (isFs) showToast('⛶ Fullscreen — hover top/bottom for controls');
}

// ─── TOAST ───────────────────────────────────────────────────
let _tt = null;
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  if (_tt) clearTimeout(_tt);
  _tt = setTimeout(() => DOM.toast.classList.remove('show'), 2800);
}

// ─── LOADING ─────────────────────────────────────────────────
function showLoading(msg) { DOM.loadingText.textContent = msg || 'Loading…'; DOM.loadingOverlay.style.display = ''; }
function updateLoadingText(msg) { DOM.loadingText.textContent = msg; }
function hideLoading() { DOM.loadingOverlay.style.display = 'none'; }
