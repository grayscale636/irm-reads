import type { BookData, ReadingLogData } from "@/contexts/BooksContext";
import { BookCover } from "./BookCover";
import { Icon } from "./Icons";

interface Props {
  logs: ReadingLogData[];
  books: BookData[];
  selectedDate: string;
  today: string;
  onClearDate: () => void;
  onLogReading: () => void;
  onDelete: (id: string) => void;
}

export function DailyLog({ logs, books, selectedDate, today, onClearDate, onLogReading, onDelete }: Props) {
  const dayLogs = logs
    .filter((l) => l.date === selectedDate)
    .map((l) => ({ ...l, book: books.find((b) => b.id === l.bookId) }))
    .filter((l): l is typeof l & { book: BookData } => Boolean(l.book));

  const totalPages = dayLogs.reduce((s, l) => s + l.pagesRead, 0);
  const isToday = selectedDate === today;

  const dateLabel = new Date(selectedDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="irm-daylog">
      <div className="irm-section-head">
        <div>
          <h2 className="irm-section-title">
            {isToday ? "Today" : dateLabel}
            {!isToday && (
              <button className="irm-section-clear" onClick={onClearDate}>
                <Icon.X size={12} /> back to today
              </button>
            )}
          </h2>
          <p className="irm-section-sub">
            {dayLogs.length === 0 ? (
              <>No reading logged</>
            ) : (
              <>
                <span className="irm-mono">{totalPages}</span> pages across{" "}
                <span className="irm-mono">{dayLogs.length}</span>{" "}
                {dayLogs.length === 1 ? "session" : "sessions"}
              </>
            )}
          </p>
        </div>
        <button className="irm-btn irm-btn--primary" onClick={onLogReading}>
          <Icon.Plus size={14} /> Log reading
        </button>
      </div>

      {dayLogs.length === 0 ? (
        <div className="irm-empty">
          <div className="irm-empty__icon">
            <Icon.Book size={20} />
          </div>
          <div className="irm-empty__text">
            {isToday ? "You haven't logged any reading today." : "No sessions on this day."}
          </div>
          <button className="irm-btn irm-btn--ghost" onClick={onLogReading}>
            <Icon.Plus size={13} /> Log a session
          </button>
        </div>
      ) : (
        <>
          <ul className="irm-loglist">
            {dayLogs.map((log) => (
              <li key={log.id} className="irm-logitem">
                <BookCover book={log.book} size="sm" />
                <div className="irm-logitem__body">
                  <div className="irm-logitem__title">{log.book.title}</div>
                  <div className="irm-logitem__meta irm-mono">
                    {log.startPage > 0 ? (
                      <>
                        p.{log.startPage} → p.{log.endPage}
                      </>
                    ) : (
                      <>session</>
                    )}
                  </div>
                </div>
                <div className="irm-logitem__pages">
                  <span className="irm-mono irm-logitem__pages-num">{log.pagesRead}</span>
                  <span className="irm-logitem__pages-label">pages</span>
                </div>
                <button className="irm-logitem__delete" style={{ opacity: 1 }} onClick={() => { if (confirm('Delete this reading session?')) onDelete(log.id); }} title="Delete">
                  <Icon.Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="irm-loglist__total">
            <span>Total</span>
            <span className="irm-mono">{totalPages} pages</span>
          </div>
        </>
      )}
    </section>
  );
}
