# Quick Notes 📝

A fast, elegant, distraction-free desktop notes application built with **React 19**, **Vite**, and **Electron 45**. Designed with an editorial, paper-inspired aesthetic for capturing thoughts, tasks, and ideas effortlessly.

---

## ✨ Features

### Core Experience (Phase 1)
- **Editorial & Minimalist Design:** Warm paper palette, polished typography (*Playfair Display* & *DM Sans*), and clean hierarchy.
- **Fast & Responsive:** Instant load times with hot-module reloading powered by Vite.
- **Instant Search:** Real-time filter across note titles and content with `⌘F`.
- **Keyboard Shortcuts:** Native shortcuts for new note (`⌘N`), save (`⌘S`), search (`⌘F`), and close window (`⌘W`).

### Persistence & Desktop Integration (Phase 2)
- **Main-Process Persistence:** Notes and settings stored in `app.getPath('userData')` (`notes.json` and `settings.json`).
- **Resilient File Operations:** Atomic writes via temporary files and rename to avoid corruption, automatic backup of malformed files (`notes.corrupted.*.json`), and race-condition-free write queue.
- **Safe One-Time Migration:** Automatic migration from Phase 1 browser `localStorage` to main-process JSON storage with conflict preservation.
- **Secure IPC Architecture:** Strict `contextIsolation: true`, `nodeIntegration: false`, strong Content Security Policy, and sanitized IPC payload validation.
- **Native macOS Menu:** Standard application menu with File, Edit, View, and Window accelerators wired to real actions.
- **Light / Dark Editorial Theme:** Persistent theme toggle switching between Warm Paper (Light) and Deep Ink Slate (Dark).

### Advanced Electron Features (Phase 3)
- **Multiple Windows (Detached Notes):** Pop out any note into a dedicated, focused note window. Windows are deduplicated (focusing existing window if already open) and synchronize live across windows.
- **Native File Dialogs & Export:** Export notes directly to Markdown (`.md`) or Plain Text (`.txt`) using macOS native save dialogs with sanitized filenames.
- **System Tray / Menu Bar Integration:** macOS menu bar icon with quick actions to Show Quick Notes, Create New Note, or Quit. Uses macOS template icons for automatic contrast inversion.
- **Delete Confirmation:** Native confirmation dialog preventing accidental permanent deletion.
- **Autosave Status:** Live feedback indicators displaying *Saving...*, *Saved*, or *Save error* reflecting actual disk persistence.
- **Packaging & Distribution:** Packaged with Electron Forge into native macOS `.app` bundles, `.zip` archives, and `.dmg` Apple Disk Images.

---

## 🛠️ Tech Stack

- **Desktop Framework:** [Electron 45](https://www.electronjs.org/)
- **Frontend Library:** [React 19](https://react.dev/)
- **Bundler & Tooling:** [Vite 8](https://vite.dev/)
- **Packaging:** [Electron Forge 8](https://www.electronforge.io/) + macOS `hdiutil`
- **Styling:** Modern Vanilla CSS (CSS Custom Properties & Responsive Flexbox)
- **Test Runner:** Node.js native test runner (`node:test` & `node:assert`)
- **Code Quality:** ESLint Flat Config

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended, tested on Node v24)
- `npm` (comes with Node.js)
- macOS (for native macOS menu, tray, and DMG generation)

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
| `npm run build` | Compiles and builds production web assets to `/dist` |
| `npm run preview` | Previews the production web build locally |
| `npm run lint` | Runs ESLint across all JavaScript and JSX files |
| `npm test` | Runs automated unit and integration tests via `node:test` |
| `npm run package` | Builds renderer and packages the application bundle with Electron Forge |
| `npm run make` | Builds renderer and generates distributable `.zip` archive |
| `npm run dist` | Generates both `.zip` and `.dmg` (Apple Disk Image) distributables |

---

## 🔒 Electron Security Architecture & IPC Design

Security is fundamental to Quick Notes:
- **`contextIsolation: true`**: The renderer process runs in an isolated context and cannot access Node.js internals or Electron internals directly.
- **`nodeIntegration: false`**: Node.js integration is disabled in all renderer windows.
- **Content Security Policy (CSP)**: `index.html` restricts scripts to self and inline styles with specific allowed origins (Google Fonts).
- **No Raw IPC Exposure**: `ipcRenderer` is never exposed directly on `window`. Only explicit, strictly-typed functions are exposed on `window.quickNotesAPI` via `contextBridge`.
- **Main-Process Validation**: Every incoming IPC request is validated in the main process (`electron/validation.js`), rejecting unexpected fields, malicious prototypes, invalid types, or invalid IDs before touching storage or dialogs.

### IPC API Surface (`window.quickNotesAPI`)

```typescript
interface QuickNotesAPI {
  getNotes(): Promise<Note[]>;
  createNote(data?: Partial<Note>): Promise<Note>;
  updateNote(id: string, patch: { title?: string; content?: string }): Promise<Note>;
  deleteNote(id: string): Promise<{ success: boolean; id: string }>;
  migrateNotes(legacyNotes: Note[]): Promise<{ migratedCount: number; totalCount: number }>;
  getTheme(): Promise<'light' | 'dark'>;
  setTheme(theme: 'light' | 'dark'): Promise<'light' | 'dark'>;
  openNoteWindow(noteId: string): Promise<{ success: boolean; reused: boolean }>;
  exportNote(noteId: string, format: 'md' | 'txt'): Promise<{ success?: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  confirmDelete(noteTitle: string): Promise<boolean>;
  onMenuAction(callback: (action: 'new-note' | 'save-note' | 'focus-search') => void): () => void;
  onNotesUpdated(callback: (notes: Note[]) => void): () => void;
}
```

---

## 💾 Storage Location & Data Migration

### Storage Location
Application data is stored on the user's local disk inside Electron's standard user data directory:
- **macOS:** `~/Library/Application Support/quick-notes/`
  - `notes.json`: JSON file containing the authoritative array of notes with version metadata.
  - `settings.json`: Persisted user preferences (theme).
  - `notes.corrupted.<timestamp>.json`: Automatic backup copy generated if malformed JSON is ever detected.

### Data Migration
When upgrading from Phase 1 (browser `localStorage`), the application performs a safe one-time migration:
1. React detects legacy notes in `localStorage.getItem("quick-notes")`.
2. Notes are sent to the main process via `quickNotesAPI.migrateNotes()`.
3. The storage module validates each note, imports non-existing notes, updates notes if strictly newer, and avoids overwriting existing persisted notes.
4. The migration flag `quick-notes-migrated` is saved, ensuring migration runs only once.

---

## 🧪 Testing Instructions

Run the automated test suite:
```bash
npm test
```

The test suite covers:
- **`test/storage.test.js`**: NotesStorage CRUD operations, missing file auto-initialization, malformed JSON recovery & backup, atomic write persistence, concurrent operations, theme persistence, and legacy `localStorage` migration without overwriting existing data.
- **`test/validation.test.js`**: Note ID validation, payload structure sanitization, update patch constraints, theme validation, and export format validation.
- **`test/export.test.js`**: Filename sanitization against illegal filesystem characters (`/ \ : * ? " < > |`), length limits, fallback names, and Markdown/Plain Text note formatting.

Run ESLint verification:
```bash
npm run lint
```

---

## 📦 Packaging & Distribution

To create distributables for macOS:
```bash
npm run dist
```

Outputs are created in `out/`:
- **Application Bundle:** `out/Quick Notes-darwin-arm64/Quick Notes.app`
- **ZIP Distribution:** `out/make/zip/darwin/arm64/Quick Notes-darwin-arm64-0.0.0.zip`
- **DMG Distribution:** `out/make/Quick-Notes.dmg`

### macOS Code Signing & Notarization Limitations
- **Current Environment:** The distributables generated in this environment are built on macOS (`darwin-arm64`).
- **Code Signing:** Without an active Apple Developer Program certificate (`Developer ID Application: ...`) configured in your keychain, the resulting `.app`, `.zip`, and `.dmg` are unsigned / ad-hoc signed.
- **macOS Gatekeeper:** On modern macOS versions (macOS Sonoma / Sequoia), opening unsigned distributed binaries downloaded from the internet will prompt Gatekeeper ("Apple could not verify the developer"). To open on another machine without an Apple certificate, right-click the `.app` and choose *Open*, or run:
  ```bash
  xattr -cr "/path/to/Quick Notes.app"
  ```
- **Notarization:** Full notarization requires submitting the build with Apple's `notarytool` using an Apple Developer account team ID and app-specific password.

---

## 📄 License

MIT © [Soham Dhande](https://github.com/sohamdhande)
