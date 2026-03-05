/* ── js/state.js ── Global state & constants ─────────────── */
'use strict';

const PAGE_SPEED_MS = { fast: 200, medium: 350, slow: 550 };
const WEIGHT_LABELS = { 300: 'Light', 400: 'Normal', 500: 'Medium', 600: 'Semibold', 700: 'Bold' };
const ESTIMATED_CHAPTER_HEIGHT = 3500; // px estimate for unrendered chapters
const VIRTUAL_WINDOW = 2;              // chapters ahead/behind to keep in DOM

const DEFAULTS = {
    theme: 'theme-sepia', fontSize: 18, lineHeight: 1.7, contentWidth: 680,
    font: 'Lora', fontWeight: 400, letterSpacing: 0, wordSpacing: 0, paraSpacing: 1,
    textIndent: false, justify: false, italic: false,
    smoothScroll: true, pageSpeed: 'fast', mode: 'scroll', brightness: 100,
    customBg: '#12121e', customText: '#e0e0f0', customSurface: '#1c1c30',
    customAccent: '#7C3AED', customMuted: '#8888aa',
};

const State = {
    // Book data
    book: null,
    chapters: [],
    currentChapter: 0,
    // Book mode
    currentPage: 0,
    pages: [],
    // Appearance
    theme: DEFAULTS.theme,
    fontSize: DEFAULTS.fontSize,
    lineHeight: DEFAULTS.lineHeight,
    contentWidth: DEFAULTS.contentWidth,
    font: DEFAULTS.font,
    fontWeight: DEFAULTS.fontWeight,
    letterSpacing: DEFAULTS.letterSpacing,
    wordSpacing: DEFAULTS.wordSpacing,
    paraSpacing: DEFAULTS.paraSpacing,
    textIndent: DEFAULTS.textIndent,
    justify: DEFAULTS.justify,
    italic: DEFAULTS.italic,
    brightness: DEFAULTS.brightness,
    customBg: DEFAULTS.customBg,
    customText: DEFAULTS.customText,
    customSurface: DEFAULTS.customSurface,
    customAccent: DEFAULTS.customAccent,
    customMuted: DEFAULTS.customMuted,
    // Reading
    mode: DEFAULTS.mode,     // 'scroll' | 'book' | 'continuous'
    smoothScroll: DEFAULTS.smoothScroll,
    pageSpeed: DEFAULTS.pageSpeed,
    // Book metadata
    bookTitle: '',
    bookId: '',
    bookmarks: [],
    toc: [],
    // Continuous reader instance (set by reader.js)
    continuousReader: null,
};

// Single DOM reference map — populated by main.js on DOMContentLoaded
const DOM = {};
