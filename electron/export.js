/**
 * Utilities for formatting notes and sanitizing filenames for export.
 */

export function sanitizeFilename(name, defaultName = "Untitled") {
  if (typeof name !== "string") {
    return defaultName;
  }

  // Replace control characters and illegal filename symbols: / \ : * ? " < > |
  let sanitized = "";
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    const char = name[i];
    if (code < 32 || code === 127 || '\\/:*?"<>|'.includes(char)) {
      sanitized += "_";
    } else {
      sanitized += char;
    }
  }

  sanitized = sanitized
    .trim()
    .replace(/\.+$/, "") // Remove trailing dots
    .replace(/\s+/g, " "); // Normalize whitespace

  // Limit length
  if (sanitized.length > 80) {
    sanitized = sanitized.slice(0, 80).trim();
  }

  return sanitized.length > 0 ? sanitized : defaultName;
}

export function formatNoteForExport(note, format = "md") {
  const title = (note && typeof note.title === "string" ? note.title.trim() : "") || "Untitled";
  const content = (note && typeof note.content === "string" ? note.content : "");

  if (format === "md") {
    return `# ${title}\n\n${content}\n`;
  }

  return `${title}\n${"=".repeat(Math.max(title.length, 20))}\n\n${content}\n`;
}
