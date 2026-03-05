/* ── js/idb.js ── IndexedDB helpers for EPUB storage ─────────── */
'use strict';

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
        return new Promise((resolve) => {
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
