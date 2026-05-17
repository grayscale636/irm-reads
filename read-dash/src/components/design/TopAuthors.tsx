import type { BookData } from "@/contexts/BooksContext";
import { topAuthors } from "@/lib/readingInsights";

interface Props {
  books: BookData[];
}

export function TopAuthors({ books }: Props) {
  // Pull top 10; the list scrolls past row 4 in the UI so the card height
  // matches its trio neighbours.
  const top = topAuthors(books, 10);
  const max = top[0]?.pages ?? 1;
  const uniqueAuthors = new Set(books.map((b) => (b.author || "Unknown").trim() || "Unknown")).size;

  return (
    <div className="irm-insight">
      <div className="irm-insight__head">
        <div>
          <div className="irm-insight__eyebrow">Top authors</div>
          <div className="irm-insight__title irm-insight__title--sub">
            <span className="irm-mono">{uniqueAuthors}</span> author{uniqueAuthors === 1 ? "" : "s"} in your library
          </div>
        </div>
      </div>

      {top.length === 0 ? (
        <div className="irm-insight__empty">Log some pages and your top authors will appear here.</div>
      ) : (
        <ul className="irm-authors">
          {top.map((a) => {
            const pct = Math.round((a.pages / max) * 100);
            return (
              <li key={a.author} className="irm-authors__item">
                <div className="irm-authors__row">
                  <span className="irm-authors__name">{a.author}</span>
                  <span className="irm-mono irm-authors__pages">{a.pages.toLocaleString()}p</span>
                </div>
                <div className="irm-authors__bar">
                  <div className="irm-authors__bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="irm-authors__meta">
                  <span className="irm-mono">{a.books}</span> book{a.books === 1 ? "" : "s"}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
