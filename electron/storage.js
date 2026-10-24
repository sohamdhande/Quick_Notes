import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  validateNoteId,
  validateNoteData,
  validateUpdatePatch,
  validateTheme,
  validateMigrationNotes,
} from "./validation.js";

/**
 * NotesStorage manages local persistence for notes and settings
 * in the Electron user data directory.
 */
export class NotesStorage {
  constructor(dataDir) {
    if (!dataDir) {
      throw new Error("NotesStorage requires a data directory path");
    }
    this.dataDir = dataDir;
    this.notesFilePath = path.join(dataDir, "notes.json");
    this.settingsFilePath = path.join(dataDir, "settings.json");

    this._notesCache = null;
    this._settingsCache = null;
    this._writeQueue = Promise.resolve();
    this._initialized = false;
  }

  /**
   * Ensure directory exists and initial data is loaded into memory cache.
   */
  async init() {
    if (this._initialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });
    await this._loadNotesFromDisk();
    await this._loadSettingsFromDisk();
    this._initialized = true;
  }

  /**
   * Internal: Read and parse notes from disk.
   */
  async _loadNotesFromDisk() {
    try {
      const data = await fs.readFile(this.notesFilePath, "utf8");
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed)) {
        this._notesCache = parsed;
      } else if (parsed && Array.isArray(parsed.notes)) {
        this._notesCache = parsed.notes;
      } else {
        throw new Error("Invalid notes JSON structure: expected array or { notes: [] }");
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        // Missing file is normal on first run; initialize with empty array
        this._notesCache = [];
        await this._saveNotesToDisk();
      } else if (err instanceof SyntaxError || err.message.includes("Invalid notes JSON")) {
        // Corrupted JSON: preserve damaged file so user data is never destroyed
        const backupPath = path.join(
          this.dataDir,
          `notes.corrupted.${Date.now()}.json`
        );
        try {
          await fs.copyFile(this.notesFilePath, backupPath);
          console.error(`Malformed notes.json backed up to: ${backupPath}`);
        } catch {
          // Ignore copy failure
        }
        // Initialize clean state so application can function
        this._notesCache = [];
      } else {
        throw err;
      }
    }
  }

  /**
   * Internal: Read and parse settings from disk.
   */
  async _loadSettingsFromDisk() {
    try {
      const data = await fs.readFile(this.settingsFilePath, "utf8");
      const parsed = JSON.parse(data);
      this._settingsCache = typeof parsed === "object" && parsed !== null ? parsed : { theme: "light" };
    } catch (err) {
      if (err.code === "ENOENT" || err instanceof SyntaxError) {
        this._settingsCache = { theme: "light" };
        await this._saveSettingsToDisk();
      } else {
        throw err;
      }
    }
  }

  /**
   * Internal: Atomic write to disk using temp file + rename.
   */
  async _atomicWrite(targetPath, content) {
    const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, targetPath);
  }

  /**
   * Internal: Serialized write for notes to prevent race conditions.
   */
  async _saveNotesToDisk() {
    const payload = JSON.stringify({ version: 1, notes: this._notesCache }, null, 2);
    this._writeQueue = this._writeQueue.then(async () => {
      await this._atomicWrite(this.notesFilePath, payload);
    });
    return this._writeQueue;
  }

  /**
   * Internal: Serialized write for settings.
   */
  async _saveSettingsToDisk() {
    const payload = JSON.stringify(this._settingsCache, null, 2);
    this._writeQueue = this._writeQueue.then(async () => {
      await this._atomicWrite(this.settingsFilePath, payload);
    });
    return this._writeQueue;
  }

  /**
   * Get all notes sorted by updatedAt descending.
   */
  async getNotes() {
    await this.init();
    return [...this._notesCache].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  /**
   * Get a single note by ID.
   */
  async getNoteById(id) {
    await this.init();
    const validatedId = validateNoteId(id);
    return this._notesCache.find((n) => n.id === validatedId) || null;
  }

  /**
   * Create a new note.
   */
  async createNote(data = {}) {
    await this.init();
    const validated = validateNoteData(data);
    const now = Date.now();

    const newNote = {
      id: validated.id || crypto.randomUUID(),
      title: validated.title || "",
      content: validated.content || "",
      createdAt: validated.createdAt || now,
      updatedAt: validated.updatedAt || now,
    };

    this._notesCache.unshift(newNote);
    await this._saveNotesToDisk();
    return { ...newNote };
  }

  /**
   * Update an existing note.
   */
  async updateNote(id, patch) {
    await this.init();
    const validatedId = validateNoteId(id);
    const validatedPatch = validateUpdatePatch(patch);

    const index = this._notesCache.findIndex((n) => n.id === validatedId);
    if (index === -1) {
      throw new Error(`Note not found: ${validatedId}`);
    }

    const currentNote = this._notesCache[index];
    const updatedNote = {
      ...currentNote,
      ...validatedPatch,
      updatedAt: Date.now(),
    };

    this._notesCache[index] = updatedNote;
    await this._saveNotesToDisk();
    return { ...updatedNote };
  }

  /**
   * Delete a note by ID.
   */
  async deleteNote(id) {
    await this.init();
    const validatedId = validateNoteId(id);

    const index = this._notesCache.findIndex((n) => n.id === validatedId);
    if (index === -1) {
      // If already deleted or not found, return success false
      return { success: false, id: validatedId, notFound: true };
    }

    this._notesCache.splice(index, 1);
    await this._saveNotesToDisk();
    return { success: true, id: validatedId };
  }

  /**
   * Safely migrate notes from localStorage.
   * Preserves existing notes; never silently overwrites existing persisted data.
   */
  async migrateNotes(legacyNotes) {
    await this.init();
    const validNotes = validateMigrationNotes(legacyNotes);

    if (validNotes.length === 0) {
      return { migratedCount: 0, totalCount: this._notesCache.length };
    }

    let migratedCount = 0;
    const existingMap = new Map(this._notesCache.map((n) => [n.id, n]));

    for (const legacy of validNotes) {
      const existing = existingMap.get(legacy.id);
      if (!existing) {
        this._notesCache.push(legacy);
        existingMap.set(legacy.id, legacy);
        migratedCount++;
      } else if (legacy.updatedAt > (existing.updatedAt || 0)) {
        // If the legacy note is strictly newer than persisted note, update it
        Object.assign(existing, legacy);
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      await this._saveNotesToDisk();
    }

    return { migratedCount, totalCount: this._notesCache.length };
  }

  /**
   * Get theme preference.
   */
  async getTheme() {
    await this.init();
    return this._settingsCache.theme || "light";
  }

  /**
   * Set theme preference.
   */
  async setTheme(theme) {
    await this.init();
    const validatedTheme = validateTheme(theme);
    this._settingsCache.theme = validatedTheme;
    await this._saveSettingsToDisk();
    return validatedTheme;
  }
}
