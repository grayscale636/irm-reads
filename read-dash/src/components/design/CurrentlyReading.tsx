import type { BookData, ReadingLogData } from "@/contexts/BooksContext";
import { BookCover } from "./BookCover";
import { ProgressBar } from "./ProgressBar";
import { Icon } from "./Icons";

interface Props {
  books: BookData[];
  logs: ReadingLogData[];
  today: string;
  onLogReading: (bookId: string) => void;
  onOpenBook?: (bookId: string) => void;
}

export function CurrentlyReading({ books, logs, today, onLogReading, onOpenBook }: Props) {
  const reading = books.filter((b) => b.status === "reading");

  if (reading.length === 0) {
    return (
      <section>
        <div className="irm-section-head">
          <div>
            <h2 className="irm-section-title">Currently reading</h2>
            <p className="irm-section-sub">No books in progress yet.</p>
          </div>
        </div>
        <div className="irm-card irm-empty" style={{ minHeight: 160 }}>
          <div className="irm-empty__icon"><Icon.Book size={20} /></div>
          <div className="irm-empty__text">
            Pick a book from your library and log your first session to get going.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="irm-section-head">
        <div>
          <h2 className="irm-section-title">Currently reading</h2>
          <p className="irm-section-sub">
            <span className="irm-mono">{reading.length}</span> book{reading.length === 1 ? "" : "s"} in progress
          </p>
        </div>
      </div>

      <div className="irm-current__grid">
        {reading.map((book) => {
          const total = book.totalPages || 1;
          const pct = Math.round((book.pagesRead / total) * 100);
          const bookLogs = logs.filter((l) => l.bookId === book.id);
          const lastDate = bookLogs.length
            ? bookLogs.slice().sort((a, b) => b.date.localeCompare(a.date))[0].date
            : null;
          const daysAgo = lastDate
            ? Math.round((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000)
            : null;
          const lastLabel =
            daysAgo === null
              ? "—"
              : daysAgo === 0
                ? "Today"
                : daysAgo === 1
                  ? "Yesterday"
                  : `${daysAgo}d ago`;

          return (
            <article
              key={book.id}
              className="irm-bookcard"
              onClick={() => onOpenBook?.(book.id)}
              style={onOpenBook ? { cursor: "pointer" } : undefined}
            >
              <BookCover book={book} size="md" />
              <div className="irm-bookcard__body">
                <div className="irm-bookcard__top">
                  <div>
                    <h3 className="irm-bookcard__title">{book.title}</h3>
                    <p className="irm-bookcard__author">{book.author}</p>
                  </div>
                  <span className="irm-pill">Reading</span>
                </div>
                <div className="irm-bookcard__progress">
                  <div className="irm-bookcard__progress-row">
                    <span className="irm-mono">
                      {book.pagesRead} / {book.totalPages}
                    </span>
                    <span className="irm-mono irm-bookcard__pct">{pct}%</span>
                  </div>
                  <ProgressBar value={book.pagesRead} max={book.totalPages} height={3} />
                </div>
                <div className="irm-bookcard__meta">
                  <span className="irm-bookcard__metaitem">
                    <span className="irm-bookcard__metalabel">Last session</span>
                    <span className="irm-mono">{lastLabel}</span>
                  </span>
                  <span className="irm-bookcard__metaitem">
                    <span className="irm-bookcard__metalabel">Started</span>
                    <span className="irm-mono">{book.startedAt ? book.startedAt.slice(5) : "—"}</span>
                  </span>
                  <button
                    className="irm-btn irm-btn--ghost irm-bookcard__log"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogReading(book.id);
                    }}
                  >
                    <Icon.Plus size={13} /> Log
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
