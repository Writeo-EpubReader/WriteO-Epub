/* ── js/settings.js ── Load / save / apply all settings ─── */
'use strict';

// ── Colour helpers ────────────────────────────────────────────
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
function lightenHex(hex, amt) {
    const clamp = v => Math.min(255, Math.max(0, v));
    const r = clamp(parseInt(hex.slice(1, 3), 16) + amt).toString(16).padStart(2, '0');
    const g = clamp(parseInt(hex.slice(3, 5), 16) + amt).toString(16).padStart(2, '0');
    const b = clamp(parseInt(hex.slice(5, 7), 16) + amt).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
function isValidHex(h) { return /^#[0-9a-fA-F]{6}$/.test(h); }

// ── Persistence ───────────────────────────────────────────────
function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('lumina_settings') || '{}');
        Object.keys(DEFAULTS).forEach(k => { if (k in s) State[k] = s[k]; });
    } catch (_) { }
}

function saveSettings() {
    const out = {};
    Object.keys(DEFAULTS).forEach(k => out[k] = State[k]);
    localStorage.setItem('lumina_settings', JSON.stringify(out));
}

function resetSettings() {
    Object.assign(State, { ...DEFAULTS });
    saveSettings();
    applySettings();
    syncCustomColorInputs();
    showToast('↺ Settings reset to defaults');
}

// ── Apply all settings → DOM + CSS vars ──────────────────────
function applySettings() {
    // Theme class
    document.body.className = State.theme;
    document.querySelectorAll('.theme-swatch').forEach(el =>
        el.classList.toggle('active', el.dataset.theme === State.theme)
    );

    // CSS variables
    const R = document.documentElement.style;
    R.setProperty('--font-size', State.fontSize + 'px');
    R.setProperty('--line-height', State.lineHeight);
    R.setProperty('--content-width', State.contentWidth + 'px');
    R.setProperty('--font-family', `'${State.font}'`);
    R.setProperty('--font-weight', State.fontWeight);
    R.setProperty('--letter-spacing', State.letterSpacing + 'px');
    R.setProperty('--word-spacing', State.wordSpacing + 'px');
    R.setProperty('--para-spacing', State.paraSpacing + 'em');
    R.setProperty('--text-indent', State.textIndent ? '2em' : '0');
    R.setProperty('--text-align', State.justify ? 'justify' : 'left');
    R.setProperty('--font-style', State.italic ? 'italic' : 'normal');
    R.setProperty('--page-speed', PAGE_SPEED_MS[State.pageSpeed] + 'ms');
    R.setProperty('--reader-brightness', State.brightness / 100);

    applyCustomCSSVars(State.customBg, State.customText, State.customSurface, State.customAccent, State.customMuted);

    if (DOM.scrollContainer) {
        DOM.scrollContainer.style.scrollBehavior = State.smoothScroll ? 'smooth' : 'auto';
    }

    // Sliders
    const sliders = [
        ['fontSizeSlider', 'fontSizeDisplay', State.fontSize + 'px'],
        ['lineHeightSlider', 'lineHeightDisplay', State.lineHeight],
        ['contentWidthSlider', 'contentWidthDisplay', State.contentWidth + 'px'],
        ['letterSpacingSlider', 'letterSpacingDisplay', State.letterSpacing + 'px'],
        ['wordSpacingSlider', 'wordSpacingDisplay', State.wordSpacing + 'px'],
        ['paraSpacingSlider', 'paraSpacingDisplay', State.paraSpacing + 'em'],
        ['brightnessSlider', 'brightnessDisplay', State.brightness + '%'],
    ];
    sliders.forEach(([slider, disp, val]) => {
        if (DOM[slider]) DOM[slider].value = parseFloat(val);
        if (DOM[disp]) DOM[disp].textContent = val;
    });

    // Toggles
    if (DOM.smoothScrollToggle) DOM.smoothScrollToggle.checked = State.smoothScroll;
    if (DOM.textIndentToggle) DOM.textIndentToggle.checked = State.textIndent;
    if (DOM.justifyToggle) DOM.justifyToggle.checked = State.justify;
    if (DOM.italicToggle) DOM.italicToggle.checked = State.italic;

    // Font buttons
    document.querySelectorAll('.font-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.font === State.font)
    );

    // Font weight buttons
    if (DOM.fontWeightDisplay) DOM.fontWeightDisplay.textContent = WEIGHT_LABELS[State.fontWeight] || 'Normal';
    document.querySelectorAll('[data-weight]').forEach(btn =>
        btn.classList.toggle('active', parseInt(btn.dataset.weight) === State.fontWeight)
    );

    // Mode buttons
    ['Scroll', 'Book', 'Continuous'].forEach(m => {
        const btn = DOM['mode' + m];
        if (btn) btn.classList.toggle('active', State.mode === m.toLowerCase());
    });

    // Speed buttons
    document.querySelectorAll('[data-speed]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.speed === State.pageSpeed)
    );

    syncCustomColorInputs();
    updatePreview();
}

// ── Custom theme ──────────────────────────────────────────────
function applyCustomCSSVars(bg, text, surface, accent, muted) {
    const R = document.documentElement.style;
    R.setProperty('--custom-bg', bg);
    R.setProperty('--custom-text', text);
    R.setProperty('--custom-surface', surface);
    R.setProperty('--custom-surface2', lightenHex(surface, 8));
    R.setProperty('--custom-border', hexToRgba(text, 0.08));
    R.setProperty('--custom-accent', accent);
    R.setProperty('--custom-muted', muted);
}

function syncCustomColorInputs() {
    const pairs = [
        ['customBg', 'customBgHex', State.customBg],
        ['customText', 'customTextHex', State.customText],
        ['customSurface', 'customSurfaceHex', State.customSurface],
        ['customAccent', 'customAccentHex', State.customAccent],
        ['customMuted', 'customMutedHex', State.customMuted],
    ];
    pairs.forEach(([picker, hex, val]) => {
        if (DOM[picker]) DOM[picker].value = val;
        if (DOM[hex]) DOM[hex].value = val;
    });
}

function updatePreview() {
    if (!DOM.themePreview) return;
    DOM.themePreview.style.background = State.customSurface;
    const bodyEl = DOM.themePreview.querySelector('.preview-body-text');
    const accentEl = DOM.themePreview.querySelector('.preview-accent-text');
    if (bodyEl) bodyEl.style.color = State.customText;
    if (accentEl) accentEl.style.color = State.customAccent;
    DOM.themePreview.style.borderColor = hexToRgba(State.customText, 0.1);
}
