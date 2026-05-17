import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useBooks } from "@/contexts/BooksContext";
import type { OutletCtx } from "@/layouts/AppLayout";
import { Icon } from "@/components/design/Icons";
import { LibraryCard } from "@/components/design/LibraryCard";

type Filter = "all" | "reading" | "completed" | "want-to-read" | "paused" | "dnf";
type SortKey = "recent" | "title" | "author" | "rating" | "progress" | "pages";

const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "want-to-read", label: "Want to read" },
  { id: "dnf", label: "DNF" },
];

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "recent", label: "Recently active" },
  { id: "title", label: "Title (A→Z)" },
  { id: "author", label: "Author (A→Z)" },
  { id: "rating", label: "Rating (high→low)" },
  { id: "progress", label: "Progress (high→low)" },
  { id: "pages", label: "Length (longest)" },
];

export default function Library() {
  const navigate = useNavigate();
  const { openAddBookDialog } = useOutletContext<OutletCtx>();
  const { books, readingLogs, isLoading } = useBooks();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [searchQuery, setSearchQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: books.length,
      reading: books.filter((b) => b.status === "reading").length,
      completed: books.filter((b) => b.status === "completed").length,
      "want-to-read": books.filter((b) => b.status === "want-to-read").length,
      paused: books.filter((b) => b.status === "paused").length,
      dnf: books.filter((b) => b.status === "dnf").length,
    }),
    [books],
  );

  // Map each book to its most recent log date for the "recent activity" sort.
  const lastActivity = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of readingLogs) {
      const prev = map.get(l.bookId);
      if (!prev || l.date > prev) map.set(l.bookId, l.date);
    }
    return map;
  }, [readingLogs]);

  const filtered = useMemo(() => {
    let result = filter === "all" ? books : books.filter((b) => b.status === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
      );
    }
    const sorted = [...result];
    switch (sort) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        sorted.sort((a, b) => a.author.localeCompare(b.author) || a.title.localeCompare(b.title));
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title));
        break;
      case "progress":
        sorted.sort((a, b) => (b.progress || 0) - (a.progress || 0));
        break;
      case "pages":
        sorted.sort((a, b) => (b.totalPages || 0) - (a.totalPages || 0));
        break;
      case "recent":
      default: {
        const fallback = (b: typeof books[number]) =>
          b.finishedAt || b.startedAt || "";
        sorted.sort((a, b) => {
          const ad = lastActivity.get(a.id) || fallback(a);
          const bd = lastActivity.get(b.id) || fallback(b);
          return bd.localeCompare(ad);
        });
      }
    }
    return sorted;
  }, [books, filter, searchQuery, sort, lastActivity]);

  if (isLoading) {
    return (
      <div className="irm-loading"><div className="irm-spinner" /></div>
    );
  }

  return (
    <div className="irm-main">
      <div className="irm-page-head">
        <div>
          <p className="irm-eyebrow">Library</p>
          <h1 className="irm-page-title">Your books</h1>
          <p className="irm-page-sub">
            <span className="irm-mono">{books.length}</span> books ·{" "}
            <span className="irm-mono">{counts.reading}</span> in progress
          </p>
        </div>
        <div className="irm-library__head-actions">
          <label className="irm-search">
            <Icon.Search size={14} />
            <input
              className="irm-search__input"
              placeholder="Search books, authors…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="irm-journal__searchclear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <Icon.X size={12} />
              </button>
            )}
          </label>
          <button className="irm-btn irm-btn--primary" onClick={openAddBookDialog}>
            <Icon.Plus size={14} /> Add book
          </button>
        </div>
      </div>

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
        <label className="irm-sort">
          <span className="irm-sort__label">Sort by</span>
          <select
            className="irm-sort__select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="irm-card irm-empty" style={{ minHeight: 240 }}>
          <div className="irm-empty__icon"><Icon.Book size={20} /></div>
          <div className="irm-empty__text">
            {searchQuery ? `No books match "${searchQuery}"` : "No books in this shelf yet."}
          </div>
          {!searchQuery && (
            <button className="irm-btn irm-btn--ghost" onClick={openAddBookDialog}>
              <Icon.Plus size={13} /> Add your first book
            </button>
          )}
        </div>
      ) : (
        <div className="irm-library__grid">
          {filtered.map((book) => (
            <LibraryCard key={book.id} book={book} onClick={() => navigate(`/book/${book.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
