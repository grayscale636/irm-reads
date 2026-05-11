import type { BookData, ReadingLogData } from "@/contexts/BooksContext";
import { BookCover } from "./BookCover";
import { ProgressBar } from "./ProgressBar";
import { Icon } from "./Icons";
import { projectFinish, stallStatus, formatEta } from "@/lib/readingInsights";

interface Props {
  books: BookData[];
  logs: ReadingLogData[];
  today: string;
  onLogReading: (bookId: string) => void;
  onOpenBook?: (bookId: string) => void;
}

const STALL_LABEL: Record<string, string> = {
  fresh: "Reading",
  cooling: "Cooling",
  stalled: "Stalled",
  frozen: "Frozen",
};

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

  // Surface count of books that need attention (stalled or frozen).
  const needAttention = reading.filter((b) => {
    const s = stallStatus(b, logs, today);
    return s.level === "stalled" || s.level === "frozen";
  }).length;

  return (
    <section>
      <div className="irm-section-head">
        <div>
          <h2 className="irm-section-title">Currently reading</h2>
          <p className="irm-section-sub">
            <span className="irm-mono">{reading.length}</span> book{reading.length === 1 ? "" : "s"} in progress
            {needAttention > 0 && (
              <>
                {" · "}
                <span className="irm-section-sub__warn">
                  <span className="irm-mono">{needAttention}</span> need{needAttention === 1 ? "s" : ""} attention
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="irm-current__grid">
        {reading.map((book) => {
          const total = book.totalPages || 1;
          const pct = Math.round((book.pagesRead / total) * 100);
          const stall = stallStatus(book, logs, today);
          const projection = projectFinish(book, logs, today);

          const lastLabel =
            stall.daysSinceLast === null
              ? "—"
              : stall.daysSinceLast === 0
                ? "Today"
                : stall.daysSinceLast === 1
                  ? "Yesterday"
                  : `${stall.daysSinceLast}d ago`;

          return (
            <article
              key={book.id}
              className={`irm-bookcard irm-bookcard--${stall.level}`}
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
                  <span className={`irm-pill irm-pill--${stall.level}`}>{STALL_LABEL[stall.level]}</span>
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
                <div className="irm-bookcard__projection">
                  {projection ? (
                    <>
                      <span className="irm-bookcard__metalabel">Projected finish</span>
                      <span className="irm-mono irm-bookcard__projection-eta">
                        {formatEta(projection.etaDate, today)}
                      </span>
                      <span className="irm-bookcard__projection-pace">
                        @ <span className="irm-mono">{projection.pagesPerDay.toFixed(1)}</span> pg/day
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="irm-bookcard__metalabel">Projected finish</span>
                      <span className="irm-bookcard__projection-pace">
                        Log a session to project pace
                      </span>
                    </>
                  )}
                </div>
                <div className="irm-bookcard__meta">
                  <span className="irm-bookcard__metaitem">
                    <span className="irm-bookcard__metalabel">Last session</span>
                    <span
                      className={`irm-mono${stall.level === "stalled" || stall.level === "frozen" ? " irm-bookcard__last--warn" : ""}`}
                    >
                      {lastLabel}
                    </span>
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
