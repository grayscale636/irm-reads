// Client-side export / backup. Everything is assembled from existing API
// endpoints so there's no server-side export surface to maintain.
import {
  getAllBooks,
  getAllReadingLogs,
  getAllNotes,
  getGoal,
  normalizeQuote,
  type Book,
  type ReadingLog,
  type BookNote,
} from "./api";

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Safe-ish filename from a book title.
function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "book";
}

const stamp = () => new Date().toISOString().slice(0, 10);

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) (out[key(it)] ||= []).push(it);
  return out;
}

/** Assemble the full backup object: books with nested notes/logs/quotes, plus goals. */
export async function buildBackup() {
  const [books, logs, notes] = await Promise.all([
    getAllBooks(),
    getAllReadingLogs(),
    getAllNotes(),
  ]);

  // Goals live per-year; back up every year that appears in the data.
  const years = new Set<number>([new Date().getFullYear()]);
  for (const b of books) {
    for (const d of [b.startedAt, b.finishedAt]) {
      const y = d ? parseInt(d.slice(0, 4), 10) : NaN;
      if (!Number.isNaN(y)) years.add(y);
    }
  }
  for (const l of logs) {
    const y = parseInt(l.date.slice(0, 4), 10);
    if (!Number.isNaN(y)) years.add(y);
  }
  const goalPairs = await Promise.all(
    [...years].map(async (y) => [y, await getGoal(y)] as const),
  );
  const goals: Record<string, number> = {};
  for (const [y, target] of goalPairs) if (target != null) goals[y] = target;

  const notesByBook = groupBy(notes, (n) => n.bookId);
  const logsByBook = groupBy(logs, (l) => l.bookId);

  return {
    app: "irm-reads",
    version: 1,
    exportedAt: new Date().toISOString(),
    goals,
    books: books.map((b) => ({
      ...b,
      quotes: (Array.isArray(b.quotes) ? b.quotes : []).map(normalizeQuote),
      // Drop the denormalized book title/author repeated on each journal note.
      notes: (notesByBook[b.id] || []).map(({ bookTitle: _t, bookAuthor: _a, ...n }) => n),
      readingLogs: logsByBook[b.id] || [],
    })),
  };
}

/** Download the full library as a JSON backup file. */
export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  triggerDownload(
    `irm-reads-backup-${stamp()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json",
  );
}

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  completed: "Completed",
  "want-to-read": "Want to read",
  paused: "Paused",
  dnf: "Did not finish",
};

/** Render a single book — metadata, reflection, notes, quotes — as Markdown. */
export function bookToMarkdown(book: Book, notes: BookNote[], logs: ReadingLog[]): string {
  const lines: string[] = [];
  lines.push(`# ${book.title}`);
  lines.push(`*by ${book.author}*`, "");

  const meta: string[] = [`- **Status:** ${STATUS_LABEL[book.status] || book.status}`];
  if (book.rating > 0) meta.push(`- **Rating:** ${book.rating}/5`);
  if (book.totalPages > 0) {
    const pct = Math.round((book.pagesRead / book.totalPages) * 100);
    meta.push(`- **Progress:** ${book.pagesRead}/${book.totalPages} (${pct}%)`);
  }
  if (book.startedAt) meta.push(`- **Started:** ${book.startedAt}`);
  if (book.finishedAt) meta.push(`- **Finished:** ${book.finishedAt}`);
  lines.push(...meta, "");

  if (book.reflection?.trim()) {
    lines.push("## Reflection", "", book.reflection.trim(), "");
  }

  if (notes.length > 0) {
    lines.push("## Notes", "");
    for (const n of notes) {
      const bits: string[] = [];
      if (n.noteType && n.noteType !== "note") bits.push(`**[${n.noteType}]**`);
      if (n.pageRef) bits.push(`(p.${n.pageRef})`);
      const prefix = bits.length ? bits.join(" ") + " " : "";
      const tags = n.tags?.length ? ` — ${n.tags.map((t) => `#${t}`).join(" ")}` : "";
      const date = n.createdAt ? `  _(${n.createdAt.slice(0, 10)})_` : "";
      lines.push(`- ${prefix}${n.text}${tags}${date}`);
    }
    lines.push("");
  }

  const quotes = (Array.isArray(book.quotes) ? book.quotes : []).map(normalizeQuote);
  if (quotes.length > 0) {
    lines.push("## Quotes", "");
    for (const q of quotes) {
      lines.push(`> ${q.text}`);
      const cite: string[] = [];
      if (q.page) cite.push(`p.${q.page}`);
      if (q.date) cite.push(q.date.slice(0, 10));
      if (q.tags?.length) cite.push(q.tags.map((t) => `#${t}`).join(" "));
      if (cite.length) lines.push(`> — ${cite.join(" · ")}`);
      lines.push("");
    }
  }

  if (logs.length > 0) {
    lines.push("## Reading log", "");
    for (const l of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
      const range = l.startPage > 0 ? `p.${l.startPage}→${l.endPage}` : `p.${l.pagesRead}`;
      lines.push(`- ${l.date} · ${range} · ${l.pagesRead} pages`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Download a single book as a Markdown file. */
export function downloadBookMarkdown(book: Book, notes: BookNote[], logs: ReadingLog[]): void {
  triggerDownload(`${slugify(book.title)}.md`, bookToMarkdown(book, notes, logs), "text/markdown");
}
