/**
 * Validation utilities for Electron IPC payloads and storage operations.
 */

export function validateNoteId(id) {
  if (typeof id !== "string") {
    throw new Error("Invalid note ID: must be a string");
  }
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    throw new Error("Invalid note ID: length must be between 1 and 128 characters");
  }
  return trimmed;
}

export function validateNoteData(data = {}) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid note payload: must be an object");
  }

  const sanitized = {};

  if (data.id !== undefined) {
    sanitized.id = validateNoteId(data.id);
  }

  if (data.title !== undefined) {
    if (typeof data.title !== "string") {
      throw new Error("Invalid note title: must be a string");
    }
    sanitized.title = data.title;
  } else {
    sanitized.title = "";
  }

  if (data.content !== undefined) {
    if (typeof data.content !== "string") {
      throw new Error("Invalid note content: must be a string");
    }
    sanitized.content = data.content;
  } else {
    sanitized.content = "";
  }

  if (data.createdAt !== undefined) {
    if (typeof data.createdAt !== "number" || isNaN(data.createdAt)) {
      throw new Error("Invalid createdAt timestamp: must be a number");
    }
    sanitized.createdAt = data.createdAt;
  }

  if (data.updatedAt !== undefined) {
    if (typeof data.updatedAt !== "number" || isNaN(data.updatedAt)) {
      throw new Error("Invalid updatedAt timestamp: must be a number");
    }
    sanitized.updatedAt = data.updatedAt;
  }

  return sanitized;
}

export function validateUpdatePatch(patch = {}) {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    throw new Error("Invalid update patch: must be an object");
  }

  const allowedKeys = ["title", "content"];
  const keys = Object.keys(patch);

  if (keys.length === 0) {
    throw new Error("Invalid update patch: must contain at least one field to update");
  }

  const sanitized = {};
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Unauthorized update field: ${key}`);
    }
    if (typeof patch[key] !== "string") {
      throw new Error(`Field '${key}' must be a string`);
    }
    sanitized[key] = patch[key];
  }

  return sanitized;
}

export function validateTheme(theme) {
  if (typeof theme !== "string") {
    throw new Error("Theme must be a string");
  }
  const normalized = theme.toLowerCase().trim();
  if (normalized !== "light" && normalized !== "dark") {
    throw new Error("Invalid theme: must be 'light' or 'dark'");
  }
  return normalized;
}

export function validateMigrationNotes(notes) {
  if (!Array.isArray(notes)) {
    throw new Error("Migration payload must be an array of notes");
  }

  const validNotes = [];
  for (const item of notes) {
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const id = typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : null;
      if (!id) continue;

      const title = typeof item.title === "string" ? item.title : "";
      const content = typeof item.content === "string" ? item.content : "";
      const updatedAt = typeof item.updatedAt === "number" && !isNaN(item.updatedAt) ? item.updatedAt : Date.now();
      const createdAt = typeof item.createdAt === "number" && !isNaN(item.createdAt) ? item.createdAt : updatedAt;

      validNotes.push({ id, title, content, createdAt, updatedAt });
    }
  }

  return validNotes;
}
