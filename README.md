# Quick Notes 📝

A fast, elegant, distraction-free desktop notes application built with **React 19**, **Vite**, and **Electron**. Designed with an editorial, paper-inspired aesthetic for capturing thoughts, tasks, and ideas effortlessly.

---

## ✨ Features

- **Editorial & Minimalist Design:** Warm paper palette, polished typography (*Playfair Display* & *DM Sans*), and clean hierarchy.
- **Fast & Responsive:** Instant load times and hot-module reloading powered by Vite.
- **Instant Search:** Filter through all your notes and note contents in real-time.
- **Auto-Saving:** Notes save automatically to your local storage as you type.
- **Local-First & Private:** All data remains strictly on your machine — no accounts, no cloud sync, complete privacy.
- **Desktop Native:** Packaged with Electron with native window behavior and keyboard shortcut cues.

---

## 🛠️ Tech Stack

- **Desktop Framework:** [Electron 45](https://www.electronjs.org/)
- **Frontend Library:** [React 19](https://react.dev/)
- **Bundler & Tooling:** [Vite 8](https://vite.dev/)
- **Styling:** Modern Vanilla CSS
- **Code Quality:** ESLint Flat Config

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sohamdhande/Quick_Notes.git
   cd Quick_Notes
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

---

## 💻 Available Scripts

| Command | Description |
|---|---|
| `npm run electron:dev` | Runs Vite dev server and launches Electron concurrently with HMR |
| `npm run dev` | Runs the web app in the browser at `http://localhost:5173` |
| `npm run build` | Compiles and builds the production web assets to `/dist` |
| `npm run preview` | Previews the production build locally in the browser |
| `npm run lint` | Runs ESLint across all JavaScript and JSX files |

---

## 📁 Project Structure

```text
Quick_Notes/
├── electron/
│   └── main.js          # Electron main process & browser window management
├── public/              # Static public assets (icons, SVGs)
├── src/
│   ├── App.jsx          # Notes state, search, and editor interface
│   ├── App.css          # Design system, sidebar, editor, and responsive styles
│   ├── index.css        # Global CSS reset and typography
│   └── main.jsx         # React application root mount
├── .gitignore           # Git ignore rules for Electron, Vite, and OS files
├── index.html           # HTML entry point
├── package.json         # Scripts, dependencies, and Electron entry configuration
└── vite.config.js       # Vite configuration with relative asset paths for Electron
```

---

## 🗺️ Roadmap

- [x] **Phase 1:** Core notes creation, real-time search, auto-save, and Electron integration.
- [ ] **Phase 2:** Rich text / Markdown support and preview.
- [ ] **Phase 3:** Categories / Tags and pinned notes.
- [ ] **Phase 4:** Export notes to Markdown (`.md`) and PDF.
- [ ] **Phase 5:** Production cross-platform installer packaging (`electron-builder`).

---

## 📄 License

MIT © [Soham Dhande](https://github.com/sohamdhande)
