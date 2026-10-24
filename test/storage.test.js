import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NotesStorage } from "../electron/storage.js";

describe("NotesStorage", () => {
  let tempDir;
  let storage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quick-notes-test-"));
    storage = new NotesStorage(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it("initializes safely with a missing file", async () => {
    const notes = await storage.getNotes();
    assert.deepEqual(notes, []);

    // File should have been created on disk
    const content = JSON.parse(await fs.readFile(path.join(tempDir, "notes.json"), "utf8"));
    assert.deepEqual(content.notes, []);
  });

  it("handles creating, reading, updating, and deleting notes", async () => {
    // Create
    const note1 = await storage.createNote({ title: "Note 1", content: "Content 1" });
    assert.ok(note1.id);
    assert.equal(note1.title, "Note 1");
    assert.equal(note1.content, "Content 1");

    const note2 = await storage.createNote({ title: "Note 2", content: "Content 2" });
    assert.ok(note2.id);

    // Read list
    const notes = await storage.getNotes();
    assert.equal(notes.length, 2);
    // Should be sorted updatedAt desc (note2 was created after note1)
    assert.equal(notes[0].id, note2.id);

    // Read single
    const found = await storage.getNoteById(note1.id);
    assert.equal(found.title, "Note 1");

    // Update
    const updated = await storage.updateNote(note1.id, { title: "Updated Note 1" });
    assert.equal(updated.title, "Updated Note 1");
    assert.equal(updated.content, "Content 1");
    assert.ok(updated.updatedAt >= note1.updatedAt);

    // Verify persistence from disk with fresh instance
    const freshStorage = new NotesStorage(tempDir);
    const persisted = await freshStorage.getNotes();
    assert.equal(persisted.length, 2);
    const persistedNote1 = persisted.find((n) => n.id === note1.id);
    assert.equal(persistedNote1.title, "Updated Note 1");

    // Delete
    const deleteResult = await storage.deleteNote(note2.id);
    assert.equal(deleteResult.success, true);
    assert.equal(deleteResult.id, note2.id);

    const remaining = await storage.getNotes();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, note1.id);
  });

  it("gracefully recovers from malformed JSON and backs it up", async () => {
    // Write corrupted JSON to notes.json
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, "notes.json"), "{ corrupted: json content !!!", "utf8");

    const notes = await storage.getNotes();
    assert.deepEqual(notes, []);

    // Check that backup file was created
    const files = await fs.readdir(tempDir);
    const backupFile = files.find((f) => f.startsWith("notes.corrupted."));
    assert.ok(backupFile, "A corrupted backup file should exist");
  });

  it("safely migrates notes from localStorage without overwriting existing", async () => {
    // Create an existing note in storage
    await storage.createNote({
      id: "existing-1",
      title: "Already Persisted",
      content: "Do not overwrite",
      updatedAt: 5000,
    });

    // Migrate a list containing an older version of existing-1, plus a new note
    const legacy = [
      { id: "existing-1", title: "Old Stale Title", content: "Stale", updatedAt: 2000 },
      { id: "migrated-2", title: "Migrated Title", content: "Migrated Content", updatedAt: 6000 },
    ];

    const result = await storage.migrateNotes(legacy);
    assert.equal(result.migratedCount, 1);
    assert.equal(result.totalCount, 2);

    const notes = await storage.getNotes();
    const note1 = notes.find((n) => n.id === "existing-1");
    assert.equal(note1.title, "Already Persisted"); // Preserved!

    const note2 = notes.find((n) => n.id === "migrated-2");
    assert.equal(note2.title, "Migrated Title");
  });

  it("handles theme settings persistence", async () => {
    const initialTheme = await storage.getTheme();
    assert.equal(initialTheme, "light");

    await storage.setTheme("dark");
    assert.equal(await storage.getTheme(), "dark");

    // Fresh storage instance checks disk persistence
    const freshStorage = new NotesStorage(tempDir);
    assert.equal(await freshStorage.getTheme(), "dark");
  });
});
