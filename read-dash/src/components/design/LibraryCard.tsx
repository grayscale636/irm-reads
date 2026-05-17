import type { BookData } from "@/contexts/BooksContext";
import { BookCover } from "./BookCover";
import { ProgressBar } from "./ProgressBar";
import { Icon } from "./Icons";

const STATUS_LABEL: Record<BookData["status"], string> = {
  reading: "Reading",
  completed: "Completed",
  "want-to-read": "Want to read",
  paused: "Paused",
  dnf: "DNF",
};

interface Props {
  book: BookData;
  onClick: () => void;
}

export function LibraryCard({ book, onClick }: Props) {
  const total = book.totalPages || 1;
  const pct = Math.round((book.pagesRead / total) * 100);

  return (
    <button type="button" className="irm-libcard" onClick={onClick}>
      <BookCover book={book} size="md" />
      <div className="irm-libcard__body">
        <div className="irm-libcard__topline">
          <span className={`irm-pill irm-pill--${book.status}`}>{STATUS_LABEL[book.status]}</span>
          {book.status === "completed" && book.rating > 0 && (
            <span className="irm-libcard__rating">
              {[1, 2, 3, 4, 5].map((s) => (
                <Icon.Star key={s} size={11} filled={s <= book.rating} />
              ))}
            </span>
          )}
        </div>
        <h3 className="irm-libcard__title">{book.title}</h3>
        <p className="irm-libcard__author">{book.author}</p>
        {book.status === "reading" && (
          <div className="irm-libcard__progress">
            <div className="irm-libcard__progress-row">
              <span className="irm-mono">
                {book.pagesRead} / {book.totalPages}
              </span>
              <span className="irm-mono">{pct}%</span>
            </div>
            <ProgressBar value={book.pagesRead} max={book.totalPages} height={3} />
          </div>
        )}
        {book.status === "completed" && (
          <div className="irm-libcard__progress">
            <div className="irm-libcard__progress-row">
              <span className="irm-mono">{book.totalPages} pages</span>
              <span className="irm-mono">100%</span>
            </div>
            <ProgressBar value={1} max={1} height={3} />
          </div>
        )}
        {book.status === "want-to-read" && (
          <div className="irm-libcard__progress">
            <div className="irm-libcard__progress-row">
              <span className="irm-mono">{book.totalPages} pages</span>
              <span className="irm-libcard__queued">queued</span>
            </div>
            <div className="irm-progress" style={{ height: 3 }}>
              <div className="irm-progress__fill" style={{ width: 0 }}></div>
            </div>
          </div>
        )}
        {(book.status === "paused" || book.status === "dnf") && (
          <div className="irm-libcard__progress">
            <div className="irm-libcard__progress-row">
              <span className="irm-mono">
                {book.pagesRead} / {book.totalPages}
              </span>
              <span className="irm-mono">{pct}%</span>
            </div>
            <ProgressBar value={book.pagesRead} max={book.totalPages} height={3} />
          </div>
        )}
      </div>
    </button>
  );
}
