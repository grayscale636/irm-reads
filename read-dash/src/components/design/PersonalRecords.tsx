import type { BookData, ReadingLogData } from "@/contexts/BooksContext";
import { personalRecords } from "@/lib/readingInsights";

interface Props {
  books: BookData[];
  logs: ReadingLogData[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PersonalRecords({ books, logs }: Props) {
  const rec = personalRecords(books, logs);
  const bookById = new Map(books.map((b) => [b.id, b]));

  const items: Array<{ label: string; primary: string; secondary: string }> = [];

  items.push({
    label: "Best reading day",
    primary: rec.bestDay ? `${rec.bestDay.pages} pages` : "—",
    secondary: rec.bestDay ? formatDate(rec.bestDay.date) : "Log a session to set a record",
  });

  items.push({
    label: "Longest session",
    primary: rec.longestSession ? `${rec.longestSession.pages} pages` : "—",
    secondary: rec.longestSession
      ? bookById.get(rec.longestSession.bookId)?.title ?? formatDate(rec.longestSession.date)
      : "—",
  });

  items.push({
    label: "Fastest finish",
    primary: rec.fastestBook ? `${rec.fastestBook.days}d` : "—",
    secondary: rec.fastestBook
      ? `${rec.fastestBook.title} · ${rec.fastestBook.pages}p`
      : "Finish a book to set a record",
  });

  items.push({
    label: "Longest streak",
    primary: rec.longestStreak > 0 ? `${rec.longestStreak} days` : "—",
    secondary: rec.longestStreak > 0 ? "consecutive reading" : "Build a streak",
  });

  return (
    <div className="irm-insight">
      <div className="irm-insight__head">
        <div>
          <div className="irm-insight__eyebrow">Personal records</div>
          <div className="irm-insight__title irm-insight__title--sub">All-time highlights</div>
        </div>
      </div>
      <div className="irm-records">
        {items.map((item) => (
          <div key={item.label} className="irm-records__item">
            <div className="irm-records__label">{item.label}</div>
            <div className="irm-records__primary irm-mono">{item.primary}</div>
            <div className="irm-records__secondary">{item.secondary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
