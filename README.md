# WriteO Epub Reader

<div align="center">

![WriteO Epub Reader](https://img.shields.io/badge/WriteO-Epub%20Reader-7C3AED?style=for-the-badge&logo=bookstack&logoColor=white)
[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success?style=for-the-badge&logo=github)](https://writeo-epubreader.github.io/WriteO-Epub)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Made with ❤️ by WriteO](https://img.shields.io/badge/Made%20by-WriteO-7C3AED?style=for-the-badge)](https://writeo.app)

**A free, beautiful, browser-based EPUB reader — no install, no sign-up, no tracking.**

[**🚀 Open the Reader**](https://writeo-epubreader.github.io/WriteO-Epub) · [**✍️ Visit WriteO**](https://writeo.app) · [**🐛 Report a Bug**](https://github.com/writeo-epubreader/WriteO-Epub/issues) · [**💡 Request a Feature**](https://github.com/writeo-epubreader/WriteO-Epub/issues)

</div>

---

## 🌟 About

**WriteO Epub Reader** is the official free EPUB reading tool created by the [WriteO](https://writeo.app) team — the free novel writing and management platform for authors.

It runs entirely in your browser. No server, no sign-up, no data collection. Your books stay on your device.

> **WriteO** is a free platform for writers to organize chapters, develop characters, and write their novels — all in one place. Try it at **[writeo.app](https://writeo.app)**.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📖 **Three Reading Modes** | Scroll, Book (paginated), and Continuous (infinite scroll) |
| 🎨 **12 Preset Themes** | Dark, Light, Sepia, Midnight, Forest, Ocean, Rose, Amber, Slate, AMOLED, Lavender, Moss |
| 🖌️ **Custom Theme Builder** | Define your own background, text, accent, surface, and muted colors |
| 🔤 **14 Font Choices** | Lora, Merriweather, Playfair, Crimson, Garamond, Baskerville, and more |
| 📐 **Full Typography Control** | Font size, weight, line spacing, letter spacing, word spacing, paragraph gap, indentation |
| 📏 **Adjustable Page Width** | 320 px to 1600 px content width slider |
| 🔖 **Auto + Manual Bookmarks** | Automatically resumes where you left off; manual bookmarks per chapter |
| 💾 **Persistent Book Storage** | Books up to 50 MB are cached in your browser (IndexedDB) — no re-upload needed |
| 🗂️ **Table of Contents** | Full TOC panel with chapter navigation |
| ⛶ **Fullscreen Mode** | Distraction-free reading |
| 🕶️ **Auto-Hide Top Bar** | Controls slide away after 3 seconds of inactivity |
| ☀️ **Brightness Control** | Reader brightness slider (50%–100%) |
| ⌨️ **Keyboard Shortcuts** | Arrow keys, F (fullscreen), B (bookmark), T (TOC), Escape |
| 📱 **Mobile Friendly** | Responsive layout with touch support |
| 🚫 **No Tracking** | Zero analytics, zero cookies, zero server calls |

---

## 🚀 Live Demo

**[→ Open WriteO Epub Reader](https://writeo-epubreader.github.io/WriteO-Epub)**

---

## 🛠️ How to Use

1. Visit the [live reader](https://writeo-epubreader.github.io/WriteO-Epub)
2. Click **"Open EPUB File"** and select any `.epub` file
3. Your book loads instantly — no upload to any server
4. Customize themes, fonts, and layout from the ⚙️ Settings panel
5. Your reading position is saved automatically

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `→` / `PageDown` | Next chapter / page |
| `←` / `PageUp` | Previous chapter / page |
| `F` | Toggle fullscreen |
| `B` | Add bookmark |
| `T` | Toggle Table of Contents |
| `Escape` | Close panels |

---

## 🏗️ Project Structure

```
WriteO-Epub/
├── index.html          # Main app shell & HTML
├── about.html          # About WriteO page
├── style.css           # All styles and themes
└── js/
    ├── idb.js          # IndexedDB helpers (book persistence)
    ├── state.js        # Global app state
    ├── logger.js       # Debug logging
    ├── epub.js         # EPUB parser (JSZip-based)
    ├── settings.js     # Settings persistence & application
    ├── bookmarks.js    # Bookmark management
    ├── ui.js           # Panels, TOC, toast, auto-hide bar
    ├── reader.js       # All three reading modes
    ├── events.js       # Event binding, file handling
    └── main.js         # Entry point & DOM wiring
```

---

## 💻 Run Locally

This is a fully static site — no build step needed.

```bash
git clone https://github.com/writeo-epubreader/WriteO-Epub.git
cd WriteO-Epub

# Serve with any static server, for example:
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please keep pull requests focused and describe what problem they solve.

---

## 🐛 Known Issues & Roadmap

- [ ] Search within book text
- [ ] Night mode scheduled auto-switch
- [ ] DRM-free `.epub` drag-and-drop from file manager on iOS
- [x] Persistent book storage (IndexedDB)
- [x] Continuous infinite scroll mode
- [x] Custom theme builder
- [x] Auto-hide top bar

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## ✍️ About WriteO

This reader is built and maintained by the **[WriteO](https://writeo.app)** team.

**WriteO** is a **free novel writing platform** for authors. Organize your chapters, develop detailed character profiles, visualize story relationships, and write your masterpiece — completely free, no subscription.

🔗 **[Try WriteO at writeo.app →](https://writeo.app)**

---

<div align="center">

Made with ❤️ by [WriteO](https://writeo.app) — the free novel writing platform.

</div>
