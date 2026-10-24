import { useEffect, useState, useRef, useCallback } from "react";
import "./App.css";

const STORAGE_KEY = "quick-notes";
const MIGRATED_KEY = "quick-notes-migrated";

function createEmptyNote() {
  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function formatDate(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

export default function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const detachedNoteId = queryParams.get("noteId");
  const isDetachedWindow = Boolean(detachedNoteId);

  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(detachedNoteId || null);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("light");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const searchInputRef = useRef(null);
  const pendingUpdateRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const notesRef = useRef(notes);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Persist pending note changes to main process
  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const pending = pendingUpdateRef.current;
    if (!pending) return;

    pendingUpdateRef.current = null;
    setSaveStatus("saving");

    try {
      if (window.quickNotesAPI) {
        await window.quickNotesAPI.updateNote(pending.id, {
          title: pending.title,
          content: pending.content,
        });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notesRef.current));
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save note:", err);
      setSaveStatus("error");
      setErrorMessage("Could not save changes to disk. Please check file permissions.");
    }
  }, []);

  // Flush on window close / unload to avoid losing recent edits
  useEffect(() => {
    function handleBeforeUnload() {
      flushPendingSave();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushPendingSave]);

  // Initial load, theme sync, and localStorage migration
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        let loadedTheme = "light";
        if (window.quickNotesAPI) {
          loadedTheme = await window.quickNotesAPI.getTheme();
        } else {
          loadedTheme = localStorage.getItem("quick-notes-theme") || "light";
        }
        if (isMounted) {
          setTheme(loadedTheme);
          document.documentElement.setAttribute("data-theme", loadedTheme);
        }

        let loadedNotes = [];
        if (window.quickNotesAPI) {
          // Check for Phase 1 legacy localStorage migration
          const legacyRaw = localStorage.getItem(STORAGE_KEY);
          const alreadyMigrated = localStorage.getItem(MIGRATED_KEY);

          if (legacyRaw && !alreadyMigrated) {
            try {
              const legacyNotes = JSON.parse(legacyRaw);
              if (Array.isArray(legacyNotes) && legacyNotes.length > 0) {
                await window.quickNotesAPI.migrateNotes(legacyNotes);
                localStorage.setItem(MIGRATED_KEY, "true");
              }
            } catch (err) {
              console.warn("Legacy localStorage migration failed to parse:", err);
            }
          }

          loadedNotes = await window.quickNotesAPI.getNotes();
        } else {
          // Fallback for standalone browser testing
          const saved = localStorage.getItem(STORAGE_KEY);
          loadedNotes = saved ? JSON.parse(saved) : [];
        }

        if (isMounted) {
          setNotes(loadedNotes);
          if (detachedNoteId) {
            setActiveId(detachedNoteId);
          } else if (loadedNotes.length > 0) {
            setActiveId(loadedNotes[0].id);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        if (isMounted) {
          setErrorMessage("Failed to load notes from main process storage.");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [detachedNoteId]);

  const handleAddNote = useCallback(async () => {
    await flushPendingSave();

    const newNoteData = createEmptyNote();
    try {
      let createdNote;
      if (window.quickNotesAPI) {
        createdNote = await window.quickNotesAPI.createNote(newNoteData);
      } else {
        createdNote = newNoteData;
        const updated = [createdNote, ...notesRef.current];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }

      setNotes((current) => [createdNote, ...current.filter((n) => n.id !== createdNote.id)]);
      setActiveId(createdNote.id);
      setSearch("");
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to create note:", err);
      setErrorMessage("Could not create a new note.");
    }
  }, [flushPendingSave]);

  // Listen for native menu shortcuts and external cross-window note updates
  useEffect(() => {
    if (!window.quickNotesAPI) return;

    const cleanupMenu = window.quickNotesAPI.onMenuAction((action) => {
      if (action === "new-note") {
        handleAddNote();
      } else if (action === "save-note") {
        flushPendingSave();
      } else if (action === "focus-search") {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    });

    const cleanupNotes = window.quickNotesAPI.onNotesUpdated((updatedNotes) => {
      setNotes(updatedNotes);
    });

    return () => {
      cleanupMenu();
      cleanupNotes();
    };
  }, [flushPendingSave, handleAddNote]);

  // Window-level keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event) {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      if (isCmdOrCtrl && event.key === "n" && !isDetachedWindow) {
        event.preventDefault();
        handleAddNote();
      } else if (isCmdOrCtrl && event.key === "s") {
        event.preventDefault();
        flushPendingSave();
      } else if (isCmdOrCtrl && event.key === "f" && !isDetachedWindow) {
        event.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flushPendingSave, handleAddNote, isDetachedWindow]);

  const activeNote = notes.find((note) => note.id === activeId);

  // Update window title when active note changes
  useEffect(() => {
    if (activeNote && activeNote.title) {
      document.title = `${activeNote.title.trim()} — Quick Notes`;
    } else {
      document.title = "Quick Notes";
    }
  }, [activeNote]);

  const filteredNotes = notes
    .filter((note) =>
      `${note.title} ${note.content}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function handleSelectNote(id) {
    if (id === activeId) return;
    flushPendingSave();
    setActiveId(id);
  }

  function handleUpdateNote(field, value) {
    if (!activeId) return;

    const now = Date.now();
    let updatedNoteObj = null;

    setNotes((current) =>
      current.map((note) => {
        if (note.id === activeId) {
          updatedNoteObj = {
            ...note,
            [field]: value,
            updatedAt: now,
          };
          return updatedNoteObj;
        }
        return note;
      })
    );

    if (updatedNoteObj) {
      pendingUpdateRef.current = updatedNoteObj;
      setSaveStatus("saving");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        flushPendingSave();
      }, 400);
    }
  }

  async function handleDeleteNote(id) {
    if (!activeNote) return;

    const confirmed = window.quickNotesAPI
      ? await window.quickNotesAPI.confirmDelete(activeNote.title)
      : window.confirm(
          `Are you sure you want to delete "${activeNote.title || "Untitled"}"?`
        );

    if (!confirmed) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingUpdateRef.current = null;

    try {
      if (window.quickNotesAPI) {
        await window.quickNotesAPI.deleteNote(id);
      }
      const remaining = notes.filter((note) => note.id !== id);
      setNotes(remaining);

      if (!window.quickNotesAPI) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      }

      if (isDetachedWindow) {
        window.close();
      } else if (activeId === id) {
        setActiveId(
          remaining.length
            ? [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
            : null
        );
      }
      setSaveStatus("saved");
      showToast("Note deleted");
    } catch (err) {
      console.error("Failed to delete note:", err);
      setErrorMessage("Could not delete note from disk.");
    }
  }

  async function handleOpenInNewWindow() {
    if (!activeNote || !window.quickNotesAPI) return;
    await flushPendingSave();
    try {
      await window.quickNotesAPI.openNoteWindow(activeNote.id);
    } catch (err) {
      console.error("Failed to open note window:", err);
      setErrorMessage("Could not open note in separate window.");
    }
  }

  async function handleExport(format) {
    if (!activeNote) return;
    await flushPendingSave();

    if (window.quickNotesAPI) {
      try {
        const result = await window.quickNotesAPI.exportNote(activeNote.id, format);
        if (result.canceled) {
          // User canceled native save dialog; silently ignore
          return;
        }
        if (result.success) {
          showToast(`Exported to ${result.filePath.split("/").pop()}`);
        } else if (result.error) {
          setErrorMessage(`Export failed: ${result.error}`);
        }
      } catch (err) {
        console.error("Export error:", err);
        setErrorMessage("Could not export note.");
      }
    } else {
      // Browser fallback
      const blob = new Blob([activeNote.content || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeNote.title || "Untitled"}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded note as .${format}`);
    }
  }

  async function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);

    try {
      if (window.quickNotesAPI) {
        await window.quickNotesAPI.setTheme(nextTheme);
      } else {
        localStorage.setItem("quick-notes-theme", nextTheme);
      }
    } catch (err) {
      console.error("Failed to persist theme:", err);
    }
  }

  return (
    <main className={`app ${isDetachedWindow ? "detached-app" : ""}`}>
      {!isDetachedWindow && (
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">N</div>
            <div>
              <h1>Quick Notes</h1>
              <p>Your personal workspace</p>
            </div>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? "☾" : "☼"}
            </button>
          </div>

          <button className="new-note-button" onClick={handleAddNote}>
            <span>＋</span> New note
            <span className="shortcut">⌘ N</span>
          </button>

          <div className="section-label">
            <span>YOUR NOTES</span>
            <span>{notes.length}</span>
          </div>

          <div className="search-box">
            <span>⌕</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search your notes... (⌘F)"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="notes-list">
            {loading ? (
              <div className="list-empty">
                <span>⏳</span>
                <p>Loading notes...</p>
              </div>
            ) : (
              <>
                {filteredNotes.map((note) => (
                  <button
                    className={`note-card ${
                      activeId === note.id ? "selected" : ""
                    }`}
                    key={note.id}
                    onClick={() => handleSelectNote(note.id)}
                  >
                    <div className="note-card-heading">
                      <span className="note-dot" />
                      <span className="note-date">
                        {formatDate(note.updatedAt)}
                      </span>
                    </div>

                    <div className="note-card-title">
                      {note.title.trim() || "Untitled note"}
                    </div>

                    <div className="note-card-preview">
                      {note.content.trim() || "No additional text"}
                    </div>
                  </button>
                ))}

                {filteredNotes.length === 0 && (
                  <div className="list-empty">
                    <span>{search ? "⌕" : "✳"}</span>
                    <p>{search ? "No matching notes" : "No notes yet"}</p>
                    <small>
                      {search
                        ? "Try a different search."
                        : "Create a note to get started."}
                    </small>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="sidebar-footer">
            <span className="status-dot" />
            <span>Stored securely on device</span>
          </div>
        </aside>
      )}

      <section className="editor">
        {errorMessage && (
          <div className="error-banner">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        {toastMessage && (
          <div className="toast">
            <span>✓ {toastMessage}</span>
          </div>
        )}

        {activeNote ? (
          <>
            <header className="editor-toolbar">
              <div className="breadcrumb">
                {isDetachedWindow ? "Detached Note" : "My Notes"} <span>/</span>{" "}
                {activeNote.title.trim() || "Untitled"}
              </div>

              <div className="toolbar-actions">
                <span className={`save-status status-${saveStatus}`}>
                  <span className={`status-dot status-dot-${saveStatus}`} />
                  {saveStatus === "saving" && "Saving..."}
                  {saveStatus === "saved" && "Saved"}
                  {saveStatus === "error" && "Save error"}
                </span>

                <div className="export-group">
                  <button
                    className="action-button"
                    onClick={() => handleExport("md")}
                    title="Export note as Markdown (.md)"
                    aria-label="Export note as Markdown"
                  >
                    Export .md
                  </button>
                  <button
                    className="action-button"
                    onClick={() => handleExport("txt")}
                    title="Export note as Plain Text (.txt)"
                    aria-label="Export note as Plain Text"
                  >
                    .txt
                  </button>
                </div>

                {!isDetachedWindow && (
                  <button
                    className="action-button popout-button"
                    onClick={handleOpenInNewWindow}
                    title="Open note in separate window"
                    aria-label="Open note in separate window"
                  >
                    <span>⧉</span> Pop out
                  </button>
                )}

                {isDetachedWindow && (
                  <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                  >
                    {theme === "light" ? "☾" : "☼"}
                  </button>
                )}

                <button
                  className="delete-button"
                  onClick={() => handleDeleteNote(activeNote.id)}
                  title="Delete note"
                  aria-label="Delete note"
                >
                  Delete <span>⌫</span>
                </button>
              </div>
            </header>

            <div className="editor-content">
              <div className="editor-meta">
                <span className="document-icon">▤</span>
                <span>NOTE</span>
                <span className="meta-divider">·</span>
                <span>Edited {formatDate(activeNote.updatedAt)}</span>
              </div>

              <input
                className="title-input"
                placeholder="Untitled"
                value={activeNote.title}
                onChange={(event) =>
                  handleUpdateNote("title", event.target.value)
                }
                aria-label="Note title"
              />

              <div className="content-hint">
                Capture your thoughts, ideas, and plans.
              </div>

              <textarea
                className="note-textarea"
                placeholder={"Start writing here...\n\nYour ideas deserve a place to live."}
                value={activeNote.content}
                onChange={(event) =>
                  handleUpdateNote("content", event.target.value)
                }
                aria-label="Note content"
              />

              <div className="editor-bottom">
                <span>
                  {activeNote.content.length} characters
                </span>
                <span>QUICK NOTES</span>
              </div>
            </div>
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-icon">N</div>
            <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
            <h2>
              {isDetachedWindow ? "Note not found" : "A little space\nfor your thoughts."}
            </h2>
            <p className="welcome-description">
              {isDetachedWindow
                ? "This note may have been deleted in another window."
                : "Keep ideas, reminders, and everything worth remembering in one simple place."}
            </p>
            {!isDetachedWindow && (
              <button className="welcome-button" onClick={handleAddNote}>
                Create your first note
              </button>
            )}
            <div className="welcome-shortcut">
              Simple by design. Always yours.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}