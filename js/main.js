/* ── js/main.js ── Entry point, init, DOM wiring ─────────────── */
'use strict';

function populateDOM() {
    const $ = id => document.getElementById(id);

    // Screens
    DOM.welcomeScreen = $('welcome-screen');
    DOM.readerScreen = $('reader-screen');
    DOM.fileInput = $('file-input');
    DOM.fileInputReader = $('file-input-reader');

    // Top bar
    DOM.topBar = $('top-bar');
    DOM.homeBtn = $('home-btn');
    DOM.tocBtn = $('toc-btn');
    DOM.settingsBtn = $('settings-btn');
    DOM.bookmarkBtn = $('bookmark-btn');
    DOM.fullscreenBtn = $('fullscreen-btn');
    DOM.writeoBtn = $('writeo-btn');
    DOM.bookTitle = $('book-title-display');
    DOM.progressDisplay = $('progress-display');
    DOM.progressFill = $('progress-bar-fill');

    // TOC
    DOM.tocPanel = $('toc-panel');
    DOM.tocClose = $('toc-close');
    DOM.tocOverlay = $('toc-overlay');
    DOM.tocList = $('toc-list');

    // Settings panel
    DOM.settingsPanel = $('settings-panel');
    DOM.settingsClose = $('settings-close');
    DOM.settingsOverlay = $('settings-overlay');
    DOM.applyCustomTheme = $('apply-custom-theme');
    DOM.resetSettingsBtn = $('reset-settings-btn');
    DOM.themePreview = $('theme-preview');

    // Custom colours
    DOM.customBg = $('custom-bg');
    DOM.customBgHex = $('custom-bg-hex');
    DOM.customText = $('custom-text');
    DOM.customTextHex = $('custom-text-hex');
    DOM.customSurface = $('custom-surface');
    DOM.customSurfaceHex = $('custom-surface-hex');
    DOM.customAccent = $('custom-accent');
    DOM.customAccentHex = $('custom-accent-hex');
    DOM.customMuted = $('custom-muted');
    DOM.customMutedHex = $('custom-muted-hex');

    // Sliders
    DOM.fontSizeSlider = $('font-size-slider');
    DOM.fontSizeDisplay = $('font-size-display');
    DOM.lineHeightSlider = $('line-height-slider');
    DOM.lineHeightDisplay = $('line-height-display');
    DOM.contentWidthSlider = $('content-width-slider');
    DOM.contentWidthDisplay = $('content-width-display');
    DOM.letterSpacingSlider = $('letter-spacing-slider');
    DOM.letterSpacingDisplay = $('letter-spacing-display');
    DOM.wordSpacingSlider = $('word-spacing-slider');
    DOM.wordSpacingDisplay = $('word-spacing-display');
    DOM.paraSpacingSlider = $('para-spacing-slider');
    DOM.paraSpacingDisplay = $('para-spacing-display');
    DOM.brightnessSlider = $('brightness-slider');
    DOM.brightnessDisplay = $('brightness-display');
    DOM.fontWeightDisplay = $('font-weight-display');

    // Toggles
    DOM.smoothScrollToggle = $('smooth-scroll-toggle');
    DOM.textIndentToggle = $('text-indent-toggle');
    DOM.justifyToggle = $('justify-toggle');
    DOM.italicToggle = $('italic-toggle');

    // Mode buttons
    DOM.modeScroll = $('mode-scroll');
    DOM.modeContinuous = $('mode-continuous');
    DOM.modeBook = $('mode-book');

    // Bookmarks
    DOM.bookmarksList = $('bookmarks-list');
    DOM.clearBookmarksBtn = $('clear-bookmarks-btn');

    // Reading area
    DOM.scrollContainer = $('scroll-container');
    DOM.scrollContent = $('scroll-content');
    DOM.bookContainer = $('book-container');
    DOM.bookContent = $('book-content');
    DOM.prevPageBtn = $('prev-page-btn');
    DOM.nextPageBtn = $('next-page-btn');

    // Chapter nav
    DOM.prevChapterBtn = $('prev-chapter-btn');
    DOM.nextChapterBtn = $('next-chapter-btn');
    DOM.chapterIndicator = $('chapter-indicator');
    DOM.chapterNav = $('chapter-nav');

    // Welcome
    DOM.recentBooksSection = $('recent-books-section');
    DOM.recentBooksList = $('recent-books-list');

    // Misc
    DOM.toast = $('toast');
    DOM.loadingOverlay = $('loading-overlay');
    DOM.loadingText = $('loading-text');
    DOM.writeoModal = $('writeo-modal');
    DOM.writeoModalClose = $('writeo-modal-close');
    DOM.writeoModalOverlay = $('writeo-modal-overlay');
    DOM.clearStoredBookBtn = $('clear-stored-book-btn');
}

document.addEventListener('DOMContentLoaded', () => {
    populateDOM();
    loadSettings();
    applySettings();
    loadRecentBooks();
    restoreLastBook();
    bindEvents();
});
