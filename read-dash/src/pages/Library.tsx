import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useBooks } from "@/contexts/BooksContext";
import type { OutletCtx } from "@/layouts/AppLayout";
import { Icon } from "@/components/design/Icons";
import { LibraryCard } from "@/components/design/LibraryCard";

type Filter = "all" | "reading" | "completed" | "want-to-read";

const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "completed", label: "Completed" },
  { id: "want-to-read", label: "Want to read" },
];

export default function Library() {
  const navigate = useNavigate();
  const { searchQuery, openAddBookDialog } = useOutletContext<OutletCtx>();
  const { books, isLoading } = useBooks();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: books.length,
      reading: books.filter((b) => b.status === "reading").length,
      completed: books.filter((b) => b.status === "completed").length,
      "want-to-read": books.filter((b) => b.status === "want-to-read").length,
    }),
    [books],
  );

  const filtered = useMemo(() => {
    let result = filter === "all" ? books : books.filter((b) => b.status === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
      );
    }
    return result;
  }, [books, filter, searchQuery]);

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
        <button className="irm-btn irm-btn--primary" onClick={openAddBookDialog}>
          <Icon.Plus size={14} /> Add book
        </button>
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
