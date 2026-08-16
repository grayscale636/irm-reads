import { useEffect, useState, useCallback } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useBooks, type BookData } from "@/contexts/BooksContext";
import type { OutletCtx } from "@/layouts/AppLayout";
import { Icon } from "@/components/design/Icons";
import { BookCover } from "@/components/design/BookCover";
import { ProgressBar } from "@/components/design/ProgressBar";
import { StarRating } from "@/components/design/StarRating";
import { PaceChart } from "@/components/design/PaceChart";
import { useCollapsible } from "@/hooks/use-collapsible";
import { getBookNotes, addBookNote, updateBookNote, deleteBookNote, type BookNote } from "@/lib/api";
import BookAIChat from "@/components/design/BookAIChat";

function SectionHead({ title, subtitle, expanded, onToggle, action }: {
  title: string;
  subtitle: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="irm-section-head">
      <div>
        <h2 className="irm-section-title">{title}</h2>
        <p className="irm-section-sub">{subtitle}</p>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {action}
        <button type="button" className="irm-section-toggle" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? "Collapse" : "Expand"}
          <span className="irm-section-toggle__chev"><Icon.ChevronDown size={14} /></span>
        </button>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <section className="irm-card">{children}</section>;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { today } = useOutletContext<OutletCtx>();
  const {
    books,
    readingLogs,
    isLoading,
    updateBook,
    deleteBook,
    addReadingLog,
    deleteReadingLog,
  } = useBooks();

  const book = books.find((b) => b.id === id);

  const [pagesInput, setPagesInput] = useState<string>("");
  const [logDate, setLogDate] = useState<string>(today);
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const [showAI, setShowAI] = useState(false);

  const notesColl = useCollapsible("book-notes", true);
  const quotesColl = useCollapsible("book-quotes", false);
  const historyColl = useCollapsible("book-history", false);
  const paceColl = useCollapsible("book-pace", true);

  const loadNotes = useCallback(async () => {
    if (!book?.id) return;
    setNotesLoading(true);
    try {
      const data = await getBookNotes(book.id);
      setNotes(data);
    } catch {
      // silently fail
    } finally {
      setNotesLoading(false);
    }
  }, [book?.id]);

  useEffect(() => {
    if (book) {
      setPagesInput(String(book.pagesRead));
      loadNotes();
    }
  }, [book?.id, book?.pagesRead, loadNotes]);

  useEffect(() => {
    setLogDate(today);
  }, [today]);

  if (isLoading) {
    return <div className="irm-loading"><div className="irm-spinner" /></div>;
  }

  if (!book) {
    return (
      <div className="irm-main">
        <div className="irm-card irm-empty" style={{ minHeight: 200 }}>
          <div className="irm-empty__text">Book not found.</div>
          <button className="irm-btn irm-btn--ghost" onClick={() => navigate("/")}>
            <Icon.ChevronLeft size={13} /> Back to library
          </button>
        </div>
      </div>
    );
  }

  const total = book.totalPages || 1;
  const pct = Math.round((book.pagesRead / total) * 100);
  const bookLogs = readingLogs
    .filter((l) => l.bookId === book.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const quotes: string[] = Array.isArray(book.quotes)
    ? book.quotes
    : typeof book.quotes === "string"
    ? (() => {
        try {
          const parsed = JSON.parse(book.quotes);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];

  const savePages = async () => {
    const n = Math.max(0, Math.min(book.totalPages, parseInt(pagesInput, 10) || 0));
    if (n === book.pagesRead) return;
    if (n > book.pagesRead) {
      await addReadingLog(book.id, book.pagesRead, n, logDate);
    } else {
      await updateBook(book.id, { pagesRead: n });
    }
  };

  const markComplete = async () => {
    await updateBook(book.id, { status: "completed", finishedAt: logDate });
  };

  const updateStatus = async (status: BookData["status"]) => {
    const updates: Partial<BookData> = { status };
    if (status === "completed") {
      updates.finishedAt = today;
    }
    await updateBook(book.id, updates);
  };

  const addNote = async () => {
    const text = noteInput.trim();
    if (!text) return;
    try {
      await addBookNote(book.id, text);
      setNoteInput("");
      setShowNoteForm(false);
      await loadNotes();
    } catch (e) {
      console.error("Failed to add note:", e);
    }
  };

  const removeNote = async (noteId: string) => {
    try {
      await deleteBookNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e) {
      console.error("Failed to delete note:", e);
    }
  };

  const startEditNote = (note: BookNote) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.text);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteText("");
  };

  const saveEditNote = async () => {
    if (!editingNoteId || !editNoteText.trim()) return;
    try {
      await updateBookNote(editingNoteId, editNoteText.trim());
      setNotes((prev) => prev.map((n) => n.id === editingNoteId ? { ...n, text: editNoteText.trim() } : n));
      setEditingNoteId(null);
      setEditNoteText("");
    } catch (e) {
      console.error("Failed to update note:", e);
    }
  };

  const addQuote = async () => {
    const text = quoteInput.trim();
    if (!text) return;
    await updateBook(book.id, { quotes: [...quotes, text] });
    setQuoteInput("");
    setShowQuoteForm(false);
  };

  const deleteQuote = async (index: number) => {
    const next = quotes.filter((_, i) => i !== index);
    await updateBook(book.id, { quotes: next });
  };

  const handleDeleteBook = async () => {
    if (!confirm("Delete this book and all its reading logs?")) return;
    await deleteBook(book.id);
    navigate("/");
  };

  return (
    <div className="irm-main irm-detail">
      <button className="irm-backbtn" onClick={() => navigate("/")}>
        <Icon.ChevronLeft size={14} /> Back to library
      </button>

      <div className="irm-detail__layout">
        <aside className="irm-detail__left">
          <div className="irm-detail__cover">
            <BookCover book={book} size="lg" />
            <button
              className="irm-detail__cover-edit"
              onClick={async () => {
                const url = prompt("Cover image URL", book.cover || "");
                if (url !== null) await updateBook(book.id, { cover: url });
              }}
            >
              <Icon.Camera size={14} /> Change cover
            </button>
          </div>

          <div className="irm-detail__meta">
            <h1 className="irm-detail__title">{book.title}</h1>
            <p className="irm-detail__author">by {book.author}</p>

            <div className="irm-detail__metaitem">
              <span className="irm-field__label">Rating</span>
              <StarRating
                value={book.rating}
                onChange={(r) => updateBook(book.id, { rating: r })}
                size={16}
              />
            </div>

            <div className="irm-detail__metaitem">
              <span className="irm-field__label">Status</span>
              <select
                className="irm-input"
                value={book.status}
                onChange={(e) => updateStatus(e.target.value as BookData["status"])}
              >
                <option value="want-to-read">Want to read</option>
                <option value="reading">Reading</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="dnf">DNF (Did not finish)</option>
              </select>
            </div>

            <div className="irm-detail__metaitem">
              <span className="irm-field__label">Pages</span>
              <span className="irm-mono irm-detail__metaval">
                {book.pagesRead} / {book.totalPages} · {pct}%
              </span>
            </div>

            <div className="irm-detail__metaitem">
              <button className="irm-btn irm-btn--ghost" onClick={() => setShowAI((v) => !v)}>
                💬 Bacain
              </button>
            </div>
            <div className="irm-detail__metaitem">
              <button className="irm-btn irm-btn--danger" onClick={handleDeleteBook}>
                <Icon.Trash size={13} /> Delete book
              </button>
            </div>
          </div>
        </aside>

        <div className="irm-detail__right">
          <section className="irm-card">
            <div className="irm-section-head">
              <div>
                <h2 className="irm-section-title">Reading progress</h2>
                <p className="irm-section-sub">Track where you are.</p>
              </div>
            </div>
            <div className="irm-detail__progress-grid">
              <div className="irm-detail__progress-stat">
                <div className="irm-field__label">Started</div>
                <div className="irm-mono irm-detail__progress-val">{book.startedAt || "Not started"}</div>
              </div>
              <div className="irm-detail__progress-stat">
                <div className="irm-field__label">Finished</div>
                <div className="irm-mono irm-detail__progress-val">{book.finishedAt || "Not finished"}</div>
              </div>
              <div className="irm-detail__progress-stat">
                <div className="irm-field__label">Progress</div>
                <div className="irm-detail__progress-bar">
                  <ProgressBar value={book.pagesRead} max={book.totalPages} height={6} />
                  <span className="irm-mono">{pct}%</span>
                </div>
              </div>
            </div>
            <div className="irm-detail__pages-row">
              <label className="irm-field">
                <span className="irm-field__label">
                  {book.status === "completed" ? "Pages" : "Update pages read"}
                </span>
                <div className="irm-detail__pages-inputs">
                  <input
                    type="number"
                    className="irm-input irm-mono"
                    value={pagesInput}
                    min={0}
                    max={book.totalPages}
                    data-pages-input="true"
                    disabled={book.status === "completed"}
                    onChange={(e) => setPagesInput(e.target.value)}
                  />
                  <span className="irm-detail__pages-of irm-mono">/ </span>
                  <input
                    type="date"
                    className="irm-input irm-mono"
                    style={{ width: 140 }}
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    title="Date for this reading session"
                  />
                  <input
                    type="number"
                    className="irm-input irm-mono"
                    style={{ width: 80 }}
                    defaultValue={book.totalPages}
                    min={1}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value, 10) || 0;
                      if (n > 0 && n !== book.totalPages) {
                        updateBook(book.id, { totalPages: n });
                      } else {
                        e.target.value = String(book.totalPages);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    title="Total pages"
                  />
                  {book.status !== "completed" && (
                    <button className="irm-btn irm-btn--ghost" onClick={savePages}>
                      <Icon.Check size={13} /> Save
                    </button>
                  )}
                </div>
              </label>
            </div>

          </section>

          {/* ── Notes ── */}
          <SectionCard>
            <SectionHead
              title="Notes"
              subtitle={<><span className="irm-mono">{notes.length}</span> entries</>}
              expanded={notesColl.open}
              onToggle={notesColl.toggle}
              action={
                notesColl.open && !showNoteForm && (
                  <button className="irm-btn irm-btn--ghost" onClick={() => setShowNoteForm(true)}>
                    <Icon.Plus size={13} /> Add note
                  </button>
                )
              }
            />
            {notesColl.open && <>
              {showNoteForm && (
                <div className="irm-reflect__edit" style={{ marginBottom: 16 }}>
                  <textarea
                    className="irm-input irm-textarea"
                    rows={4}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder={
                      book.status === "want-to-read"
                        ? "Why do you want to read this?"
                        : book.status === "paused"
                        ? "Why did you pause?"
                        : book.status === "dnf"
                        ? "Why did you not finish?"
                        : "Your thoughts..."
                    }
                    autoFocus
                  />
                  <div className="irm-reflect__actions">
                    <button
                      className="irm-btn irm-btn--ghost"
                      onClick={() => {
                        setNoteInput("");
                        setShowNoteForm(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="irm-btn irm-btn--primary"
                      disabled={!noteInput.trim()}
                      onClick={addNote}
                    >
                      <Icon.Check size={13} /> Save
                    </button>
                  </div>
                </div>
              )}
              {notesLoading ? (
                <div className="irm-loading" style={{ padding: 20 }}><div className="irm-spinner" /></div>
              ) : notes.length === 0 ? (
                <div className="irm-empty" style={{ padding: "24px 0" }}>
                  <div className="irm-empty__text">No notes yet.</div>
                </div>
              ) : (
                <div className="irm-notes">
                  {notes.map((n) => (
                    <div key={n.id} className="irm-note">
                      <div className="irm-note__head">
                        <div className="irm-note__meta">
                          <Icon.ChevronRight size={12} />
                          <span className="irm-note__date">
                            {new Date(n.createdAt).toLocaleDateString("en-ID", {
                              month: "short", day: "numeric"
                            })}
                          </span>
                        </div>
                        <div className="irm-note__actions">
                          <button className="irm-logitem__delete" onClick={() => startEditNote(n)}>
                            <Icon.Edit size={13} />
                          </button>
                          <button className="irm-logitem__delete" onClick={() => removeNote(n.id)}>
                            <Icon.Trash size={13} />
                          </button>
                        </div>
                      </div>
                      {editingNoteId === n.id ? (
                        <div className="irm-reflect__edit" style={{ marginTop: 6 }}>
                          <textarea
                            className="irm-input irm-textarea"
                            rows={4}
                            value={editNoteText}
                            onChange={(e) => setEditNoteText(e.target.value)}
                            autoFocus
                          />
                          <div className="irm-reflect__actions">
                            <button className="irm-btn irm-btn--ghost" onClick={cancelEditNote}>Cancel</button>
                            <button className="irm-btn irm-btn--primary" disabled={!editNoteText.trim()} onClick={saveEditNote}>
                              <Icon.Check size={13} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="irm-note__text">{n.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>}
          </SectionCard>

          {/* ── Quotes ── */}
          <SectionCard>
            <SectionHead
              title="Quotes"
              subtitle={<><span className="irm-mono">{quotes.length}</span> saved</>}
              expanded={quotesColl.open}
              onToggle={quotesColl.toggle}
              action={
                !showQuoteForm && quotesColl.open && (
                  <button className="irm-btn irm-btn--ghost" onClick={() => setShowQuoteForm(true)}>
                    <Icon.Plus size={13} /> Add
                  </button>
                )
              }
            />
            {quotesColl.open && showQuoteForm && (
              <div className="irm-reflect__edit" style={{ marginBottom: 16 }}>
                <textarea
                  className="irm-input irm-textarea"
                  rows={3}
                  value={quoteInput}
                  onChange={(e) => setQuoteInput(e.target.value)}
                  placeholder="Type or paste a quote…"
                  autoFocus
                />
                <div className="irm-reflect__actions">
                  <button
                    className="irm-btn irm-btn--ghost"
                    onClick={() => {
                      setQuoteInput("");
                      setShowQuoteForm(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="irm-btn irm-btn--primary"
                    disabled={!quoteInput.trim()}
                    onClick={addQuote}
                  >
                    <Icon.Check size={13} /> Save quote
                  </button>
                </div>
              </div>
            )}
            {quotesColl.open && (quotes.length === 0 ? (
              <div className="irm-empty" style={{ padding: "24px 0" }}>
                <div className="irm-empty__text">No quotes yet.</div>
              </div>
            ) : (
              <ul className="irm-quotes">
                {quotes.map((q, idx) => (
                  <li key={idx} className="irm-quote">
                    <div className="irm-quote__mark">"</div>
                    <div className="irm-quote__body">
                      <p className="irm-quote__text">{q}</p>
                    </div>
                    <button className="irm-logitem__delete" onClick={() => deleteQuote(idx)}>
                      <Icon.Trash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </SectionCard>

          {/* ── Reading history ── */}
          <SectionCard>
            <SectionHead
              title="Reading history"
              subtitle={<><span className="irm-mono">{bookLogs.length}</span> sessions</>}
              expanded={historyColl.open}
              onToggle={historyColl.toggle}
            />
            {historyColl.open && (bookLogs.length === 0 ? (
              <div className="irm-empty" style={{ padding: "24px 0" }}>
                <div className="irm-empty__text">No reading logged yet.</div>
                <button
                  className="irm-btn irm-btn--ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    const n = parseInt(pagesInput, 10);
                    if (n > 0 && n <= book.totalPages && n > book.pagesRead) {
                      addReadingLog(book.id, book.pagesRead, n, today);
                      return;
                    }
                    // Otherwise prompt user to fill the page count input above.
                    const input = document.querySelector<HTMLInputElement>('input[data-pages-input="true"]');
                    if (input) {
                      input.focus();
                      input.select();
                      input.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                >
                  <Icon.Plus size={13} /> Log first session
                </button>
              </div>
            ) : (
              <ul className="irm-history">
                {bookLogs.slice(0, 12).map((log) => (
                  <li key={log.id} className="irm-history__item">
                    <div className="irm-history__date irm-mono">{log.date.slice(5)}</div>
                    <div className="irm-history__range irm-mono">
                      {log.startPage > 0 ? `p.${log.startPage} → p.${log.endPage}` : `p.${log.pagesRead}`}
                    </div>
                    <div className="irm-history__pages">
                      <span className="irm-mono">{log.pagesRead}</span>
                      <span className="irm-history__pages-label">pages</span>
                    </div>
                    <button className="irm-logitem__delete" style={{ opacity: 1 }} onClick={() => { if (confirm('Delete this reading session?')) deleteReadingLog(log.id); }}>
                      <Icon.Trash size={14} />
                    </button>
                  </li>
                ))}
                {bookLogs.length > 12 && (
                  <li className="irm-history__more irm-mono">
                    + {bookLogs.length - 12} earlier sessions
                  </li>
                )}
              </ul>
            ))}
          </SectionCard>

          {/* ── Reading pace chart ── */}
          {bookLogs.length >= 2 && <SectionCard><PaceChart logs={bookLogs} height={60} /></SectionCard>}
        </div>
      </div>

      {/* AI Chat */}
      {showAI && (
        <BookAIChat
          bookId={book.id}
          bookTitle={book.title}
          bookAuthor={book.author}
          status={book.status}
          pagesRead={book.pagesRead}
          totalPages={book.totalPages}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
}
