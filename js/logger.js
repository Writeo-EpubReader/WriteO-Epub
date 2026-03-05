/* ── js/logger.js ── Lightweight debug logger ─────────────── */
'use strict';

const LOG_ENABLED = true; // set false to silence in production

function log(module, msg, data) {
    if (!LOG_ENABLED) return;
    const prefix = `%c[Lumina:${module}]`;
    const style = 'color:#7C3AED;font-weight:bold';
    if (data !== undefined) {
        console.log(prefix, style, msg, data);
    } else {
        console.log(prefix, style, msg);
    }
}

function logWarn(module, msg, data) {
    if (!LOG_ENABLED) return;
    console.warn(`[Lumina:${module}]`, msg, data !== undefined ? data : '');
}

function logError(module, msg, err) {
    console.error(`[Lumina:${module}] ❌ ${msg}`, err || '');
}
