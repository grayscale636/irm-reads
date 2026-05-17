import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooks } from "@/contexts/BooksContext";
import { getAllNotes, type JournalNote } from "@/lib/api";
import { Icon } from "@/components/design/Icons";

type Filter = "all" | "notes" | "quotes";

const PAGE_SIZE = 50;

interface Entry {
  key: string;
  type: "note" | "quote";
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  text: string;
  /** ISO date — notes only. Quotes have no date; they're sorted to the bottom. */
  date?: string;
}

const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "quotes", label: "Quotes" },
];

export default function Journal() {
  const navigate = useNavigate();
  const { books, isLoading: booksLoading } = useBooks();
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset the slice whenever filter/query changes so the user doesn't end up
  // viewing a stale window of an old filtered list.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, query]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAllNotes()
      .then((data) => {
        if (mounted) {
          setNotes(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Flatten notes + quotes into a single timeline.
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];

    for (const n of notes) {
      list.push({
        key: `n-${n.id}`,
        type: "note",
        bookId: n.bookId,
        bookTitle: n.bookTitle,
        bookAuthor: n.bookAuthor,
        text: n.text,
        date: n.createdAt,
      });
    }

    for (const book of books) {
      const quotes = Array.isArray(book.quotes) ? book.quotes : [];
      quotes.forEach((q, idx) => {
        if (!q || !q.trim()) return;
        list.push({
          key: `q-${book.id}-${idx}`,
          type: "quote",
          bookId: book.id,
          bookTitle: book.title,
          bookAuthor: book.author,
          text: q,
        });
      });
    }

    // Notes (with date) sorted by date desc; quotes (no date) appended after.
    list.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.bookTitle.localeCompare(b.bookTitle);
    });

    return list;
  }, [notes, books]);

  const counts = useMemo(() => {
    const n = entries.filter((e) => e.type === "note").length;
    const q = entries.filter((e) => e.type === "quote").length;
    return { all: n + q, notes: n, quotes: q };
  }, [entries]);

  const bookCount = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) ids.add(e.bookId);
    return ids.size;
  }, [entries]);

  const filtered = useMemo(() => {
    let list =
      filter === "all"
        ? entries
        : entries.filter((e) => (filter === "notes" ? e.type === "note" : e.type === "quote"));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) =>
          e.text.toLowerCase().includes(q) ||
          e.bookTitle.toLowerCase().includes(q) ||
          e.bookAuthor.toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, filter, query]);

  if (booksLoading || loading) {
    return (
      <div className="irm-loading">
        <div className="irm-spinner" />
      </div>
    );
  }

  return (
    <div className="irm-main">
      <div className="irm-page-head">
        <div>
          <p className="irm-eyebrow">Journal</p>
          <h1 className="irm-page-title">Notes & quotes</h1>
          <p className="irm-page-sub">
            <span className="irm-mono">{counts.notes}</span> note{counts.notes === 1 ? "" : "s"} ·{" "}
            <span className="irm-mono">{counts.quotes}</span> quote{counts.quotes === 1 ? "" : "s"}{" "}
            across <span className="irm-mono">{bookCount}</span> book{bookCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="irm-journal__toolbar">
        <div className="irm-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`irm-tab ${filter === tab.id ? "is-active" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="irm-tab__count irm-mono">{counts[tab.id]}</span>
            </button>
          ))}
        </div>
        <label className="irm-search irm-journal__search">
          <Icon.Search size={14} />
          <input
            className="irm-search__input"
            placeholder="Search text, book, author…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="irm-journal__searchclear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <Icon.X size={12} />
            </button>
          )}
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="irm-card irm-empty" style={{ minHeight: 200 }}>
          <div className="irm-empty__icon">
            <Icon.Book size={20} />
          </div>
          <div className="irm-empty__text">
            {query
              ? `No entries match "${query}"`
              : counts.all === 0
                ? "No notes or quotes yet — add some from a book detail page."
                : `No ${filter === "notes" ? "notes" : "quotes"} yet.`}
          </div>
        </div>
      ) : (
        <ul className="irm-journal">
          {filtered.slice(0, visibleCount).map((e) => (
            <li key={e.key} className={`irm-journal__item irm-journal__item--${e.type}`}>
              <div className="irm-journal__head">
                <span className={`irm-pill irm-pill--${e.type}`}>{e.type === "note" ? "Note" : "Quote"}</span>
                <button
                  type="button"
                  className="irm-journal__book"
                  onClick={() => navigate(`/book/${e.bookId}`)}
                  title="Open book"
                >
                  <span className="irm-journal__book-title">{e.bookTitle}</span>
                  <span className="irm-journal__book-author">{e.bookAuthor}</span>
                </button>
                {e.date && (
                  <span className="irm-journal__date irm-mono">
                    {new Date(e.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              <p className={`irm-journal__text${e.type === "quote" ? " irm-journal__text--quote" : ""}`}>
                {e.type === "quote" && <span className="irm-journal__quotemark">"</span>}
                {e.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > visibleCount && (
        <div className="irm-journal__more">
          <span className="irm-journal__more-count">
            Showing <span className="irm-mono">{visibleCount}</span> of{" "}
            <span className="irm-mono">{filtered.length}</span>
          </span>
          <button
            type="button"
            className="irm-btn irm-btn--ghost"
            onClick={() =>
              setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))
            }
          >
            <Icon.Plus size={13} /> Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
          </button>
        </div>
      )}
    </div>
  );
}
