import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateNoteId,
  validateNoteData,
  validateUpdatePatch,
  validateTheme,
  validateMigrationNotes,
} from "../electron/validation.js";

describe("Validation utilities", () => {
  describe("validateNoteId", () => {
    it("accepts valid string IDs", () => {
      assert.equal(validateNoteId("note-123"), "note-123");
      assert.equal(validateNoteId("  abc-def  "), "abc-def");
    });

    it("rejects non-strings or empty IDs", () => {
      assert.throws(() => validateNoteId(123), /must be a string/);
      assert.throws(() => validateNoteId(""), /between 1 and 128/);
      assert.throws(() => validateNoteId("   "), /between 1 and 128/);
      assert.throws(() => validateNoteId(null), /must be a string/);
    });
  });

  describe("validateNoteData", () => {
    it("handles default creation data", () => {
      const result = validateNoteData();
      assert.deepEqual(result, { title: "", content: "" });
    });

    it("validates fields and types", () => {
      const now = Date.now();
      const result = validateNoteData({
        id: "id-1",
        title: "Test Title",
        content: "Test Content",
        createdAt: now,
        updatedAt: now,
      });

      assert.equal(result.id, "id-1");
      assert.equal(result.title, "Test Title");
      assert.equal(result.content, "Test Content");
      assert.equal(result.createdAt, now);
      assert.equal(result.updatedAt, now);
    });

    it("rejects non-object or array payloads", () => {
      assert.throws(() => validateNoteData("string"), /must be an object/);
      assert.throws(() => validateNoteData([]), /must be an object/);
    });

    it("rejects invalid title and content types", () => {
      assert.throws(() => validateNoteData({ title: 123 }), /must be a string/);
      assert.throws(() => validateNoteData({ content: {} }), /must be a string/);
    });
  });

  describe("validateUpdatePatch", () => {
    it("accepts valid patches", () => {
      const p1 = validateUpdatePatch({ title: "New Title" });
      assert.deepEqual(p1, { title: "New Title" });

      const p2 = validateUpdatePatch({ content: "New Content" });
      assert.deepEqual(p2, { content: "New Content" });

      const p3 = validateUpdatePatch({ title: "T", content: "C" });
      assert.deepEqual(p3, { title: "T", content: "C" });
    });

    it("rejects empty patches", () => {
      assert.throws(() => validateUpdatePatch({}), /at least one field/);
    });

    it("rejects unauthorized fields", () => {
      assert.throws(
        () => validateUpdatePatch({ title: "Valid", malicious: "yes" }),
        /Unauthorized update field: malicious/
      );
    });

    it("rejects non-string values", () => {
      assert.throws(() => validateUpdatePatch({ title: null }), /must be a string/);
    });
  });

  describe("validateTheme", () => {
    it("accepts 'light' and 'dark'", () => {
      assert.equal(validateTheme("light"), "light");
      assert.equal(validateTheme("dark"), "dark");
      assert.equal(validateTheme(" DARK "), "dark");
    });

    it("rejects invalid theme strings or types", () => {
      assert.throws(() => validateTheme("blue"), /must be 'light' or 'dark'/);
      assert.throws(() => validateTheme(123), /must be a string/);
    });
  });

  describe("validateMigrationNotes", () => {
    it("filters and sanitizes legacy notes", () => {
      const input = [
        { id: "note-1", title: "One", content: "Body", updatedAt: 1000 },
        { id: "", title: "Invalid" },
        null,
        "not an object",
        { id: "note-2", title: "Two", content: "Body 2" },
      ];

      const result = validateMigrationNotes(input);
      assert.equal(result.length, 2);
      assert.equal(result[0].id, "note-1");
      assert.equal(result[0].title, "One");
      assert.equal(result[1].id, "note-2");
      assert.equal(result[1].title, "Two");
      assert.equal(typeof result[1].updatedAt, "number");
    });

    it("rejects non-array input", () => {
      assert.throws(() => validateMigrationNotes({}), /must be an array/);
    });
  });
});
