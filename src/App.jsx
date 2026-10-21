import { useEffect, useState } from "react";
import "./App.css";

const STORAGE_KEY = "quick-notes";

function loadNotes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function createNote() {
  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
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
  const [notes, setNotes] = useState(loadNotes);
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const activeNote = notes.find((note) => note.id === activeId);

  const filteredNotes = notes
    .filter((note) =>
      `${note.title} ${note.content}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function addNote() {
    const note = createNote();
    setNotes((current) => [note, ...current]);
    setActiveId(note.id);
    setSearch("");
  }

  function updateNote(field, value) {
    setNotes((current) =>
      current.map((note) =>
        note.id === activeId
          ? {
              ...note,
              [field]: value,
              updatedAt: Date.now(),
            }
          : note
      )
    );
  }

  function deleteNote(id) {
    const remaining = notes.filter((note) => note.id !== id);
    setNotes(remaining);

    if (activeId === id) {
      setActiveId(
        remaining.length
          ? remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0].id
          : null
      );
    }
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>
          <div>
            <h1>Quick Notes</h1>
            <p>Your personal workspace</p>
          </div>
        </div>

        <button className="new-note-button" onClick={addNote}>
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
            type="text"
            placeholder="Search your notes..."
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
          {filteredNotes.map((note) => (
            <button
              className={`note-card ${
                activeId === note.id ? "selected" : ""
              }`}
              key={note.id}
              onClick={() => setActiveId(note.id)}
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
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Stored on this device</span>
        </div>
      </aside>

      <section className="editor">
        {activeNote ? (
          <>
            <header className="editor-toolbar">
              <div className="breadcrumb">
                My Notes <span>/</span>{" "}
                {activeNote.title.trim() || "Untitled"}
              </div>

              <div className="toolbar-actions">
                <span className="save-status">
                  <span className="status-dot" />
                  Saved locally
                </span>
                <button
                  className="delete-button"
                  onClick={() => deleteNote(activeNote.id)}
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
                  updateNote("title", event.target.value)
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
                  updateNote("content", event.target.value)
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
            <h2>A little space<br />for your thoughts.</h2>
            <p className="welcome-description">
              Keep ideas, reminders, and everything worth remembering
              in one simple place.
            </p>
            <button className="welcome-button" onClick={addNote}>
              Create your first note
            </button>
            <div className="welcome-shortcut">
              Simple by design. Always yours.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}