import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useBooks, type BookData } from "@/contexts/BooksContext";
import type { OutletCtx } from "@/layouts/AppLayout";
import { Icon } from "@/components/design/Icons";
import { BookCover } from "@/components/design/BookCover";
import { ProgressBar } from "@/components/design/ProgressBar";
import { StarRating } from "@/components/design/StarRating";

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
  const [editingReflection, setEditingReflection] = useState(false);
  const [reflectionInput, setReflectionInput] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");

  useEffect(() => {
    if (book) {
      setPagesInput(String(book.pagesRead));
      setReflectionInput(book.reflection || "");
    }
  }, [book?.id, book?.pagesRead, book?.reflection]);

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
  const quotes = book.quotes || [];

  const savePages = async () => {
    const n = Math.max(0, Math.min(book.totalPages, parseInt(pagesInput, 10) || 0));
    if (n === book.pagesRead) return;
    if (n > book.pagesRead) {
      await addReadingLog(book.id, book.pagesRead, n, today);
    } else {
      // Direct decrease — just update without log
      await updateBook(book.id, { pagesRead: n });
    }
  };

  const markComplete = async () => {
    await updateBook(book.id, { status: "completed" });
  };

  const updateStatus = async (status: BookData["status"]) => {
    const updates: Partial<BookData> = { status };
    if (status === "completed") {
      updates.finishedAt = today;
    }
    await updateBook(book.id, updates);
  };

  const saveReflection = async () => {
    await updateBook(book.id, { reflection: reflectionInput });
    setEditingReflection(false);
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
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="irm-detail__metaitem">
              <span className="irm-field__label">Pages</span>
              <span className="irm-mono irm-detail__metaval">
                {book.pagesRead} / {book.totalPages} · {pct}%
              </span>
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
            {book.status !== "completed" && (
              <div className="irm-detail__pages-row">
                <label className="irm-field">
                  <span className="irm-field__label">Update pages read</span>
                  <div className="irm-detail__pages-inputs">
                    <input
                      type="number"
                      className="irm-input irm-mono"
                      value={pagesInput}
                      min={0}
                      max={book.totalPages}
                      onChange={(e) => setPagesInput(e.target.value)}
                      onBlur={savePages}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                    <span className="irm-detail__pages-of irm-mono">/ {book.totalPages}</span>
                    <button className="irm-btn irm-btn--ghost" onClick={markComplete}>
                      <Icon.Check size={13} /> Mark complete
                    </button>
                  </div>
                </label>
              </div>
            )}
          </section>

          <section className="irm-card">
            <div className="irm-section-head">
              <div>
                <h2 className="irm-section-title">Reflection</h2>
                <p className="irm-section-sub">Your private notes.</p>
              </div>
              {!editingReflection && book.reflection && (
                <button className="irm-btn irm-btn--ghost" onClick={() => setEditingReflection(true)}>
                  Edit
                </button>
              )}
            </div>
            {editingReflection ? (
              <div className="irm-reflect__edit">
                <textarea
                  className="irm-input irm-textarea"
                  rows={5}
                  value={reflectionInput}
                  onChange={(e) => setReflectionInput(e.target.value)}
                  placeholder="What stayed with you?"
                  autoFocus
                />
                <div className="irm-reflect__actions">
                  <button
                    className="irm-btn irm-btn--ghost"
                    onClick={() => {
                      setReflectionInput(book.reflection || "");
                      setEditingReflection(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="irm-btn irm-btn--primary" onClick={saveReflection}>
                    <Icon.Check size={13} /> Save
                  </button>
                </div>
              </div>
            ) : book.reflection ? (
              <p className="irm-reflect__text">{book.reflection}</p>
            ) : (
              <div className="irm-empty" style={{ padding: "24px 0" }}>
                <div className="irm-empty__text">No reflection yet.</div>
                <button className="irm-btn irm-btn--ghost" onClick={() => setEditingReflection(true)}>
                  <Icon.Plus size={13} /> Add reflection
                </button>
              </div>
            )}
          </section>

          <section className="irm-card">
            <div className="irm-section-head">
              <div>
                <h2 className="irm-section-title">Quotes</h2>
                <p className="irm-section-sub">
                  <span className="irm-mono">{quotes.length}</span> saved
                </p>
              </div>
              {!showQuoteForm && (
                <button className="irm-btn irm-btn--ghost" onClick={() => setShowQuoteForm(true)}>
                  <Icon.Plus size={13} /> Add quote
                </button>
              )}
            </div>
            {showQuoteForm && (
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
            {quotes.length === 0 ? (
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
            )}
          </section>

          <section className="irm-card">
            <div className="irm-section-head">
              <div>
                <h2 className="irm-section-title">Reading history</h2>
                <p className="irm-section-sub">
                  <span className="irm-mono">{bookLogs.length}</span> sessions
                </p>
              </div>
            </div>
            {bookLogs.length === 0 ? (
              <div className="irm-empty" style={{ padding: "24px 0" }}>
                <div className="irm-empty__text">No reading logged yet.</div>
              </div>
            ) : (
              <ul className="irm-history">
                {bookLogs.slice(0, 12).map((log) => (
                  <li key={log.id} className="irm-history__item">
                    <div className="irm-history__date irm-mono">{log.date.slice(5)}</div>
                    <div className="irm-history__range irm-mono">
                      {log.startPage > 0 ? `p.${log.startPage} → p.${log.endPage}` : "session"}
                    </div>
                    <div className="irm-history__pages">
                      <span className="irm-mono">{log.pagesRead}</span>
                      <span className="irm-history__pages-label">pages</span>
                    </div>
                    <button className="irm-logitem__delete" onClick={() => deleteReadingLog(log.id)}>
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
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
