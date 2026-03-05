/* ── js/epub.js ── EPUB parsing, pure logic ───────────────── */
'use strict';

async function parseEpub(file) {
    const zip = await JSZip.loadAsync(file);

    // 1. container.xml → OPF path
    const containerXml = await zip.file('META-INF/container.xml').async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const opfPath = containerDoc.querySelector('rootfile').getAttribute('full-path');
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    // 2. Parse OPF
    const opfXml = await zip.file(opfPath).async('string');
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

    const title = (opfDoc.querySelector('metadata title, dc\\:title, *|title') || {}).textContent || 'Unknown Title';

    // 3. Manifest
    const manifest = {};
    opfDoc.querySelectorAll('manifest item').forEach(item => {
        manifest[item.getAttribute('id')] = {
            href: item.getAttribute('href'),
            mediaType: item.getAttribute('media-type'),
            properties: item.getAttribute('properties') || '',
        };
    });

    // 4. Spine → reading order
    const spineItems = [];
    opfDoc.querySelectorAll('spine itemref').forEach(ref => {
        const id = ref.getAttribute('idref');
        if (manifest[id] && manifest[id].mediaType === 'application/xhtml+xml') {
            spineItems.push({ id, href: opfDir + manifest[id].href });
        }
    });

    // 5. TOC — prefer EPUB3 nav, fall back to NCX
    let toc = [];
    const navEntry = Object.values(manifest).find(m => m.properties.includes('nav'));
    if (navEntry) {
        const navFile = zip.file(opfDir + navEntry.href) || zip.file(decodeURIComponent(opfDir + navEntry.href));
        if (navFile) {
            toc = parsNavToc(new DOMParser().parseFromString(await navFile.async('string'), 'text/html'));
        }
    }
    if (!toc.length) {
        const ncxEntry = Object.values(manifest).find(m => m.mediaType === 'application/x-dtbncx+xml');
        if (ncxEntry) {
            const ncxFile = zip.file(opfDir + ncxEntry.href) || zip.file(ncxEntry.href);
            if (ncxFile) {
                toc = parseNcxToc(new DOMParser().parseFromString(await ncxFile.async('string'), 'application/xml'));
            }
        }
    }

    // 6. Load & process chapter HTML
    const chapters = [];
    for (let i = 0; i < spineItems.length; i++) {
        const item = spineItems[i];
        updateLoadingText(`Loading chapters… (${i + 1}/${spineItems.length})`);
        const zipFile = zip.file(item.href) || zip.file(decodeURIComponent(item.href));
        if (!zipFile) continue;

        let html = await zipFile.async('string');
        html = await resolveEpubResources(html, zip, item.href);

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const heading = doc.querySelector('h1, h2, h3, title');
        chapters.push({
            id: item.id,
            href: item.href,
            title: heading ? heading.textContent.trim() : `Chapter ${i + 1}`,
            content: sanitizeHtml(doc.body ? doc.body.innerHTML : html),
        });
    }

    // 7. Map TOC entries → chapter indices
    toc.forEach(entry => {
        const tocBase = (entry.href || '').split('#')[0];
        const idx = chapters.findIndex(c => {
            const chBase = c.href.split('#')[0];
            return chBase.endsWith(tocBase) || tocBase.endsWith(chBase) ||
                decodeURIComponent(chBase).endsWith(decodeURIComponent(tocBase));
        });
        if (idx !== -1) entry.chapterIndex = idx;
    });

    return { title, chapters, toc };
}

function parsNavToc(doc) {
    const items = [];
    function walk(ol, depth) {
        ol.querySelectorAll(':scope > li').forEach(li => {
            const a = li.querySelector('a');
            if (a) items.push({ title: a.textContent.trim(), href: a.getAttribute('href') || '', level: depth });
            const child = li.querySelector('ol');
            if (child) walk(child, depth + 1);
        });
    }
    const navOl = doc.querySelector('nav[epub\\:type="toc"] ol, nav ol');
    if (navOl) walk(navOl, 1);
    return items;
}

function parseNcxToc(doc) {
    const items = [];
    function walk(nodes, level) {
        nodes.forEach(node => {
            const label = node.querySelector('navLabel text');
            const content = node.querySelector('content');
            if (label && content) {
                items.push({ title: label.textContent.trim(), href: content.getAttribute('src') || '', level });
            }
            walk(node.querySelectorAll(':scope > navPoint'), level + 1);
        });
    }
    walk(doc.querySelectorAll('navMap > navPoint'), 1);
    return items;
}

async function resolveEpubResources(html, zip, chapterHref) {
    const chapterDir = chapterHref.includes('/')
        ? chapterHref.substring(0, chapterHref.lastIndexOf('/') + 1) : '';
    const doc = new DOMParser().parseFromString(html, 'text/html');

    for (const img of doc.querySelectorAll('img[src]')) {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('data:')) continue;
        try {
            const resolved = epubResolveHref(chapterDir, src);
            const imgFile = zip.file(resolved) || zip.file(decodeURIComponent(resolved));
            if (imgFile) {
                img.setAttribute('src', `data:${epubGuessMime(resolved)};base64,${await imgFile.async('base64')}`);
            }
        } catch (_) { /* skip unresolvable images */ }
    }
    return doc.documentElement.outerHTML;
}

function epubResolveHref(base, href) {
    if (href.startsWith('/')) return href.slice(1);
    const parts = (base + href).split('/'), resolved = [];
    for (const p of parts) {
        if (p === '..') resolved.pop();
        else if (p !== '.') resolved.push(p);
    }
    return resolved.join('/');
}

function epubGuessMime(href) {
    const ext = href.split('.').pop().toLowerCase();
    return {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml'
    }[ext] || 'image/jpeg';
}

function sanitizeHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '');
}
