import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NotesStorage } from "./storage.js";
import { setupApplicationMenu } from "./menu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let storage = null;

function broadcastNotesUpdated(notes, senderWebContents = null) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && (!senderWebContents || win.webContents !== senderWebContents)) {
      win.webContents.send("notes:updated", notes);
    }
  }
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
}

function createWindow() {
  const win = new BrowserWindow({
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
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }

  return win;
}

app.whenReady().then(async () => {
  storage = new NotesStorage(app.getPath("userData"));
  await storage.init();

  registerIpcHandlers();
  setupApplicationMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
