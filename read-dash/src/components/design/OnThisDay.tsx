import { useEffect, useMemo, useState } from "react";
import type { BookData } from "@/contexts/BooksContext";
import { getAllNotes, normalizeQuote, type NoteType } from "@/lib/api";
import { useCollapsible } from "@/hooks/use-collapsible";
import { Icon } from "./Icons";

interface Props {
  books: BookData[];
  today: string;
  onOpenBook: (id: string) => void;
}

interface Entry {
  key: string;
  kind: "note" | "quote";
  noteType?: NoteType;
  text: string;
  /** Calendar date (YYYY-MM-DD). */
  day: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
}

const NOTE_LABEL: Record<NoteType, string> = {
  note: "Note",
  reflection: "Reflection",
  question: "Question",
};

// Everything is compared on the YYYY-MM-DD calendar date. Timestamps and quote
// dates both start with that, so a plain slice keeps things timezone-stable.
const ymd = (s: string) => s.slice(0, 10);

const MIN_AGE_DAYS = 14; // don't resurface something you wrote this week
const MAX_ITEMS = 3;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

// "1 year ago" for anniversaries, else a coarse relative label.
function agoLabel(day: string, today: string): string {
  const years = Number(today.slice(0, 4)) - Number(day.slice(0, 4));
  if (day.slice(5) === today.slice(5) && years >= 1) {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
  const d = daysBetween(today, day);
  if (d >= 365) return `${Math.floor(d / 365)}y ago`;
  if (d >= 60) return `${Math.floor(d / 30)} months ago`;
  if (d >= 30) return "1 month ago";
  return `${d} days ago`;
}

export function OnThisDay({ books, today, onOpenBook }: Props) {
  const { open, toggle } = useCollapsible("dashboard-onthisday", true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seed, setSeed] = useState(0);

  // Reader notes come from the API; quotes ride along on each book.
  useEffect(() => {
    let mounted = true;
    getAllNotes()
      .then((notes) => {
        if (!mounted) return;
        const list: Entry[] = [];
        for (const n of notes) {
          if (!n.createdAt) continue;
          list.push({
            key: `n-${n.id}`,
            kind: "note",
            noteType: n.noteType || "note",
            text: n.text,
            day: ymd(n.createdAt),
            bookId: n.bookId,
            bookTitle: n.bookTitle,
            bookAuthor: n.bookAuthor,
          });
        }
        for (const book of books) {
          const quotes = Array.isArray(book.quotes) ? book.quotes : [];
          quotes.forEach((raw, idx) => {
            const q = normalizeQuote(raw);
            if (!q.text?.trim() || !q.date) return; // only dated quotes resurface
            list.push({
              key: `q-${book.id}-${idx}`,
              kind: "quote",
              text: q.text,
              day: ymd(q.date),
              bookId: book.id,
              bookTitle: book.title,
              bookAuthor: book.author,
            });
          });
        }
        setEntries(list);
      })
      .catch(() => { /* silent — widget just hides */ })
      .finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, [books]);

  const { items, mode } = useMemo(() => {
    // True anniversaries: same month+day, an earlier year.
    const anniversaries = entries
      .filter((e) => e.day.slice(5) === today.slice(5) && e.day.slice(0, 4) < today.slice(0, 4))
      .sort((a, b) => b.day.localeCompare(a.day));

    if (anniversaries.length > 0) {
      return { items: anniversaries.slice(0, MAX_ITEMS), mode: "anniversary" as const };
    }

    // Fallback: shuffle something older than two weeks back into view.
    const cutoff = new Date(new Date(today).getTime() - MIN_AGE_DAYS * 86400000)
      .toISOString()
      .slice(0, 10);
    const pool = entries.filter((e) => e.day < cutoff);
    if (pool.length === 0) return { items: [], mode: "resurface" as const };

    // Deterministic pick per `seed` so re-renders don't reshuffle on their own.
    const picks: Entry[] = [];
    const used = new Set<number>();
    const n = Math.min(MAX_ITEMS, pool.length);
    let cursor = seed * 2654435761;
    while (picks.length < n) {
      cursor = (cursor * 48271 + 1) % 2147483647;
      const idx = Math.abs(cursor) % pool.length;
      if (!used.has(idx)) {
        used.add(idx);
        picks.push(pool[idx]);
      }
    }
    return { items: picks, mode: "resurface" as const };
  }, [entries, today, seed]);

  // Hide entirely when there's nothing worth resurfacing (e.g. new journals).
  if (!loaded || items.length === 0) return null;

  const isAnniversary = mode === "anniversary";

  return (
    <div>
      <div className="irm-section-head">
        <div>
          <h2 className="irm-section-title">
            {isAnniversary ? "On this day" : "From your journal"}
          </h2>
          <p className="irm-section-sub">
            {isAnniversary
              ? "What you wrote on this date in years past."
              : "A few older notes worth revisiting."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {!isAnniversary && (
            <button
              type="button"
              className="irm-btn irm-btn--ghost"
              onClick={() => setSeed((s) => s + 1)}
              title="Show different entries"
            >
              🎲 Shuffle
            </button>
          )}
          <button
            type="button"
            className="irm-section-toggle"
            aria-expanded={open}
            onClick={toggle}
          >
            {open ? "Collapse" : "Expand"}
            <span className="irm-section-toggle__chev"><Icon.ChevronDown size={14} /></span>
          </button>
        </div>
      </div>
      {open && (
        <div className="irm-card">
          <ul className="irm-otd">
            {items.map((e) => (
              <li
                key={e.key}
                className="irm-otd__item"
                onClick={() => onOpenBook(e.bookId)}
              >
                <div className="irm-otd__head">
                  <span className={`irm-pill irm-pill--${e.kind === "note" ? e.noteType : "quote"}`}>
                    {e.kind === "note" ? NOTE_LABEL[e.noteType || "note"] : "Quote"}
                  </span>
                  <span className="irm-otd__book">{e.bookTitle}</span>
                  <span className="irm-otd__ago irm-mono">{agoLabel(e.day, today)}</span>
                </div>
                <p className={`irm-otd__text${e.kind === "quote" ? " irm-otd__text--quote" : ""}`}>
                  {e.kind === "quote" && <span className="irm-otd__quotemark">"</span>}
                  {e.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
