/* ── js/bookmarks.js ── Bookmark & recent-books management ── */
'use strict';

function getBookmarksKey() { return State.bookId + '_bookmarks'; }
function getAutoKey() { return State.bookId + '_auto'; }

// ── Global Bookmarks ──────────────────────────────────────────
function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem('lumina_all_bookmarks') || '[]'); }
    catch (_) { return []; }
}
function saveBookmarks() {
    localStorage.setItem('lumina_all_bookmarks', JSON.stringify(State.bookmarks));
}

// ── Auto-bookmark ─────────────────────────────────────────────
function saveAutoBookmark() {
    if (!State.bookId) { logWarn('bookmarks', 'saveAutoBookmark: no bookId'); return; }
    const data = {
        chapterIndex: State.currentChapter,
        scrollY: DOM.scrollContainer ? DOM.scrollContainer.scrollTop : 0,
        page: State.currentPage,
        timestamp: Date.now(),
    };
    localStorage.setItem(getAutoKey(), JSON.stringify(data));
    log('bookmarks', 'Auto-bookmark saved', { key: getAutoKey(), ...data });
    saveRecentBook({ id: State.bookId, title: State.bookTitle, lastChapter: State.currentChapter });
}

function loadAutoBookmark() {
    try {
        const raw = localStorage.getItem(getAutoKey());
        const data = raw ? JSON.parse(raw) : null;
        log('bookmarks', 'Auto-bookmark loaded', { key: getAutoKey(), data });
        return data;
    } catch (_) { return null; }
}

// ── Manual bookmarks ──────────────────────────────────────────
function addManualBookmark() {
    const chapter = State.chapters[State.currentChapter];
    const bm = {
        id: Date.now(),
        bookId: State.bookId,
        bookTitle: State.bookTitle,
        chapterIndex: State.currentChapter,
        chapterTitle: chapter ? chapter.title : `Chapter ${State.currentChapter + 1}`,
        scrollY: DOM.scrollContainer ? DOM.scrollContainer.scrollTop : 0,
        page: State.currentPage,
        timestamp: Date.now(),
    };
    State.bookmarks.push(bm);
    saveBookmarks();
    renderBookmarksList();
    log('bookmarks', 'Manual bookmark added', bm);
    showToast('🔖 Bookmark added');
    if (DOM.bookmarkBtn) {
        DOM.bookmarkBtn.classList.add('active');
        setTimeout(() => DOM.bookmarkBtn.classList.remove('active'), 1000);
    }
}

function goToBookmark(bm) {
    if (bm.bookId && bm.bookId !== State.bookId) {
        showToast(`Please open "${bm.bookTitle}" to load this bookmark.`);
        State.pendingBookmark = bm;
        if (DOM.fileInput) DOM.fileInput.click();
        return;
    }

    closePanel('settings');
    loadChapter(bm.chapterIndex, false).then(() => {
        if (State.mode === 'scroll') {
            requestAnimationFrame(() => { DOM.scrollContainer.scrollTop = bm.scrollY || 0; });
        } else if (State.mode === 'book') {
            State.currentPage = bm.page || 0;
            displayPage();
        } else {
            // continuous — scroll to chapter
            if (State.continuousReader) State.continuousReader.scrollToChapter(bm.chapterIndex);
        }
    });
}

function deleteBookmark(id) {
    State.bookmarks = State.bookmarks.filter(b => b.id !== id);
    saveBookmarks();
    renderBookmarksList();
}

function clearAllBookmarks() {
    State.bookmarks = [];
    saveBookmarks();
    renderBookmarksList();
    showToast('🗑️ Bookmarks cleared');
}

function renderBookmarksList() {
    if (!DOM.bookmarksList) return;
    if (!State.bookmarks.length) {
        DOM.bookmarksList.innerHTML = '<p class="empty-state">No bookmarks yet. Press <b>B</b> or 🔖 to add one.</p>';
        return;
    }
    DOM.bookmarksList.innerHTML = '';
    [...State.bookmarks].reverse().forEach(bm => {
        const item = document.createElement('div');
        item.className = 'bookmark-item';
        const d = new Date(bm.timestamp);
        item.innerHTML = `
      <div class="bookmark-item-info">
        <strong>${bm.bookTitle || 'Unknown Book'}</strong>
        <span>${bm.chapterTitle}</span>
        <small>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
      </div>
      <button class="bookmark-delete" title="Delete">✕</button>`;
        item.querySelector('.bookmark-item-info').addEventListener('click', () => goToBookmark(bm));
        item.querySelector('.bookmark-delete').addEventListener('click', () => deleteBookmark(bm.id));
        DOM.bookmarksList.appendChild(item);
    });
}

// ── Recent books ──────────────────────────────────────────────
function saveRecentBook(info) {
    try {
        let r = JSON.parse(localStorage.getItem('lumina_recents') || '[]');
        r = r.filter(x => x.id !== info.id);
        r.unshift(info);
        localStorage.setItem('lumina_recents', JSON.stringify(r.slice(0, 5)));
    } catch (_) { }
}

function loadRecentBooks() {
    if (!DOM.recentBooksSection) return;
    try {
        const r = JSON.parse(localStorage.getItem('lumina_recents') || '[]');
        if (!r.length) { DOM.recentBooksSection.style.display = 'none'; return; }
        DOM.recentBooksSection.style.display = '';
        DOM.recentBooksList.innerHTML = '';
        r.forEach(book => {
            const btn = document.createElement('button');
            btn.className = 'recent-book-item';
            btn.innerHTML = `
        <span class="recent-book-icon">📖</span>
        <div class="recent-book-info">
          <h4>${book.title || 'Unknown'}</h4>
          <p>Chapter ${(book.lastChapter || 0) + 1} · Auto-saved</p>
        </div>`;
            btn.addEventListener('click', () => {
                if (book.id === State.bookId) {
                    showReader();
                } else {
                    showToast(`Please open "${book.title}" to continue reading.`);
                    State.pendingBookmark = { bookId: book.id, chapterIndex: book.lastChapter, auto: true };
                    DOM.fileInput.click();
                }
            });
            DOM.recentBooksList.appendChild(btn);
        });
    } catch (_) { DOM.recentBooksSection.style.display = 'none'; }
}

function loadGlobalBookmarksUI() {
    if (!DOM.globalBookmarksSection) return;
    try {
        const bookmarks = loadBookmarks();
        if (!bookmarks || !bookmarks.length) { 
            DOM.globalBookmarksSection.style.display = 'none'; 
            return; 
        }
        
        DOM.globalBookmarksSection.style.display = '';
        DOM.globalBookmarksList.innerHTML = '';
        
        // Show only the 5 most recent bookmarks on the home screen
        const recentBookmarks = [...bookmarks].reverse().slice(0, 5);
        
        recentBookmarks.forEach(bm => {
            const btn = document.createElement('button');
            btn.className = 'recent-book-item';
            
            const d = new Date(bm.timestamp);
            const timeStr = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            
            btn.innerHTML = `
        <span class="recent-book-icon">🔖</span>
        <div class="recent-book-info">
          <h4>${bm.bookTitle || 'Unknown Book'}</h4>
          <p>${bm.chapterTitle} · <span style="font-size: 0.8em; opacity: 0.8;">${timeStr}</span></p>
        </div>`;
            
            btn.addEventListener('click', () => {
                if (bm.bookId === State.bookId) {
                    showReader();
                    goToBookmark(bm); // Jump to it immediately
                } else {
                    showToast(`Please open "${bm.bookTitle}" to load this bookmark.`);
                    State.pendingBookmark = bm;
                    DOM.fileInput.click();
                }
            });
            
            DOM.globalBookmarksList.appendChild(btn);
        });
    } catch (_) { DOM.globalBookmarksSection.style.display = 'none'; }
}
