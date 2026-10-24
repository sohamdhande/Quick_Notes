import { Tray, Menu, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray = null;

/**
 * Sets up the macOS menu bar / system tray icon and context menu.
 * Ensures only a single tray icon exists across the app lifecycle.
 */
export function setupSystemTray({ onShowWindow, onNewNote }) {
  if (tray && !tray.isDestroyed()) {
    return tray;
  }

  const iconPath = path.join(__dirname, "assets/trayTemplate.png");

  try {
    tray = new Tray(iconPath);
  } catch (err) {
    console.error("Failed to initialize system tray:", err);
    return null;
  }

  tray.setToolTip("Quick Notes");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Quick Notes",
      click: () => onShowWindow(),
    },
    {
      label: "New Note",
      click: () => onNewNote(),
    },
    { type: "separator" },
    {
      label: "Quit Quick Notes",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    onShowWindow();
  });

  return tray;
}

export function destroyTray() {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
}
