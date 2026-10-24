const { contextBridge, ipcRenderer } = require("electron");

/**
 * Safe, minimal bridge between Electron main process and React renderer.
 * Keeps contextIsolation: true and nodeIntegration: false.
 * Never exposes raw ipcRenderer or filesystem APIs.
 */
contextBridge.exposeInMainWorld("quickNotesAPI", {
  getNotes: () => ipcRenderer.invoke("notes:get"),
  createNote: (data) => ipcRenderer.invoke("notes:create", data),
  updateNote: (id, patch) => ipcRenderer.invoke("notes:update", { id, patch }),
  deleteNote: (id) => ipcRenderer.invoke("notes:delete", id),
  migrateNotes: (notes) => ipcRenderer.invoke("notes:migrate", notes),

  getTheme: () => ipcRenderer.invoke("settings:get-theme"),
  setTheme: (theme) => ipcRenderer.invoke("settings:set-theme", theme),

  /**
   * Listen for native menu keyboard shortcuts dispatched from main process.
   * Callback receives action: 'new-note' | 'save-note' | 'focus-search'.
   * Returns a cleanup function to unsubscribe.
   */
  onMenuAction: (callback) => {
    if (typeof callback !== "function") return () => {};
    const subscription = (_event, action) => callback(action);
    ipcRenderer.on("menu:action", subscription);
    return () => {
      ipcRenderer.removeListener("menu:action", subscription);
    };
  },

  /**
   * Listen for note updates triggered by storage or other windows.
   */
  onNotesUpdated: (callback) => {
    if (typeof callback !== "function") return () => {};
    const subscription = (_event, notes) => callback(notes);
    ipcRenderer.on("notes:updated", subscription);
    return () => {
      ipcRenderer.removeListener("notes:updated", subscription);
    };
  },
});
