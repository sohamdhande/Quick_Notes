import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NotesStorage } from "./storage.js";
import { setupApplicationMenu } from "./menu.js";
import { setupSystemTray, destroyTray } from "./tray.js";
import { sanitizeFilename, formatNoteForExport } from "./export.js";
import { validateNoteId, validateExportFormat } from "./validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let storage = null;
let mainWindow = null;
const noteWindows = new Map(); // noteId -> BrowserWindow

function broadcastNotesUpdated(notes, senderWebContents = null) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && (!senderWebContents || win.webContents !== senderWebContents)) {
      win.webContents.send("notes:updated", notes);
    }
  }
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 750,
    minHeight: 500,
    title: "Quick Notes",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

async function openNoteWindow(noteId) {
  const validatedId = validateNoteId(noteId);

  // If already open, focus the existing window to prevent duplicates
  if (noteWindows.has(validatedId)) {
    const existing = noteWindows.get(validatedId);
    if (!existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return { success: true, reused: true };
    }
    noteWindows.delete(validatedId);
  }

  const note = await storage.getNoteById(validatedId);
  const noteTitle = note && note.title ? `${note.title.trim()} — Quick Notes` : "Note — Quick Notes";

  const win = new BrowserWindow({
    width: 720,
    height: 640,
    minWidth: 460,
    minHeight: 380,
    title: noteTitle,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  noteWindows.set(validatedId, win);

  win.on("closed", () => {
    noteWindows.delete(validatedId);
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"), {
      query: { noteId: validatedId },
    });
  } else {
    win.loadURL(`http://localhost:5173?noteId=${encodeURIComponent(validatedId)}`);
  }

  return { success: true, reused: false };
}

function registerIpcHandlers() {
  ipcMain.handle("notes:get", async () => {
    return await storage.getNotes();
  });

  ipcMain.handle("notes:create", async (event, data) => {
    const created = await storage.createNote(data);
    const allNotes = await storage.getNotes();
    broadcastNotesUpdated(allNotes, event.sender);
    return created;
  });

  ipcMain.handle("notes:update", async (event, { id, patch }) => {
    const updated = await storage.updateNote(id, patch);
    const allNotes = await storage.getNotes();
    broadcastNotesUpdated(allNotes, event.sender);
    return updated;
  });

  ipcMain.handle("notes:delete", async (event, id) => {
    const result = await storage.deleteNote(id);
    const allNotes = await storage.getNotes();
    broadcastNotesUpdated(allNotes, event.sender);

    // If a detached window exists for this note, close it
    if (noteWindows.has(id)) {
      const win = noteWindows.get(id);
      if (!win.isDestroyed()) {
        win.close();
      }
      noteWindows.delete(id);
    }

    return result;
  });

  ipcMain.handle("notes:migrate", async (event, legacyNotes) => {
    const result = await storage.migrateNotes(legacyNotes);
    const allNotes = await storage.getNotes();
    broadcastNotesUpdated(allNotes, event.sender);
    return result;
  });

  ipcMain.handle("settings:get-theme", async () => {
    return await storage.getTheme();
  });

  ipcMain.handle("settings:set-theme", async (_event, theme) => {
    return await storage.setTheme(theme);
  });

  ipcMain.handle("window:open-note", async (_event, noteId) => {
    return await openNoteWindow(noteId);
  });

  ipcMain.handle("dialog:confirm-delete", async (event, noteTitle) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender);
    const displayTitle = typeof noteTitle === "string" && noteTitle.trim() ? `"${noteTitle.trim()}"` : "this note";

    const result = await dialog.showMessageBox(parentWin || undefined, {
      type: "warning",
      buttons: ["Delete Note", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: "Confirm Deletion",
      message: `Permanently delete ${displayTitle}?`,
      detail: "This note will be removed from your device storage and cannot be restored.",
    });

    return result.response === 0;
  });

  ipcMain.handle("notes:export", async (event, { noteId, format }) => {
    const validatedId = validateNoteId(noteId);
    const validatedFormat = validateExportFormat(format);

    const note = await storage.getNoteById(validatedId);
    if (!note) {
      throw new Error(`Note not found: ${validatedId}`);
    }

    const parentWin = BrowserWindow.fromWebContents(event.sender);
    const safeTitle = sanitizeFilename(note.title);
    const defaultName = `${safeTitle}.${validatedFormat}`;
    const defaultPath = path.join(app.getPath("documents"), defaultName);

    const filterName = validatedFormat === "md" ? "Markdown Document" : "Plain Text Document";
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin || undefined, {
      title: `Export Note as ${validatedFormat.toUpperCase()}`,
      defaultPath,
      filters: [
        { name: filterName, extensions: [validatedFormat] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    try {
      const formatted = formatNoteForExport(note, validatedFormat);
      await fs.writeFile(filePath, formatted, "utf8");
      return { success: true, filePath };
    } catch (err) {
      console.error("Export write failure:", err);
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(async () => {
  storage = new NotesStorage(app.getPath("userData"));
  await storage.init();

  registerIpcHandlers();
  setupApplicationMenu();

  setupSystemTray({
    onShowWindow: () => {
      createMainWindow();
    },
    onNewNote: () => {
      const win = createMainWindow();
      win.webContents.send("menu:action", "new-note");
    },
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  destroyTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
