import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFilename, formatNoteForExport } from "../electron/export.js";

describe("Export utilities", () => {
  describe("sanitizeFilename", () => {
    it("handles standard note titles", () => {
      assert.equal(sanitizeFilename("Meeting Notes"), "Meeting Notes");
      assert.equal(sanitizeFilename("Project 2026 Plan"), "Project 2026 Plan");
    });

    it("replaces illegal filesystem characters", () => {
      assert.equal(sanitizeFilename("Notes / Ideas: 2026?"), "Notes _ Ideas_ 2026_");
      assert.equal(sanitizeFilename('File "with" <illegal> | symbols *'), "File _with_ _illegal_ _ symbols _");
    });

    it("falls back to default name on empty or invalid input", () => {
      assert.equal(sanitizeFilename(""), "Untitled");
      assert.equal(sanitizeFilename("    "), "Untitled");
      assert.equal(sanitizeFilename("...", "CustomDefault"), "CustomDefault");
      assert.equal(sanitizeFilename(null, "Fallback"), "Fallback");
    });

    it("truncates excessively long titles", () => {
      const longTitle = "A".repeat(120);
      const sanitized = sanitizeFilename(longTitle);
      assert.equal(sanitized.length, 80);
    });
  });

  describe("formatNoteForExport", () => {
    it("formats markdown document with heading and body", () => {
      const note = { title: "Grocery List", content: "- Milk\n- Bread" };
      const md = formatNoteForExport(note, "md");
      assert.equal(md, "# Grocery List\n\n- Milk\n- Bread\n");
    });

    it("formats plain text document with title and separator", () => {
      const note = { title: "Grocery List", content: "Milk, Bread" };
      const txt = formatNoteForExport(note, "txt");
      assert.ok(txt.startsWith("Grocery List\n====="));
      assert.ok(txt.includes("Milk, Bread"));
    });

    it("handles missing title or content gracefully", () => {
      const md = formatNoteForExport(null, "md");
      assert.equal(md, "# Untitled\n\n\n");
    });
  });
});
