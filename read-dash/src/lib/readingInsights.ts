import type { BookData, ReadingLogData } from "@/contexts/BooksContext";

const MS_PER_DAY = 86400000;

export type StallLevel = "fresh" | "cooling" | "stalled" | "frozen";

export interface StallStatus {
  daysSinceLast: number | null;
  level: StallLevel;
  lastDate: string | null;
}

export interface FinishProjection {
  pagesPerDay: number;
  daysToFinish: number;
  etaDate: string;
  windowDays: number;
  activeDaysInWindow: number;
}

function toDate(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(a: string, b: string): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / MS_PER_DAY);
}

function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function stallStatus(
  book: BookData,
  logs: ReadingLogData[],
  today: string,
): StallStatus {
  const bookLogs = logs.filter((l) => l.bookId === book.id);
  if (bookLogs.length === 0) {
    // No logs ever. Fall back to startedAt if present, otherwise unknown.
    if (book.startedAt) {
      const days = diffDays(today, book.startedAt);
      return { daysSinceLast: days, level: levelFromDays(days), lastDate: null };
    }
    return { daysSinceLast: null, level: "fresh", lastDate: null };
  }

  const last = bookLogs.reduce((acc, l) => (l.date > acc ? l.date : acc), bookLogs[0].date);
  const days = Math.max(0, diffDays(today, last));
  return { daysSinceLast: days, level: levelFromDays(days), lastDate: last };
}

function levelFromDays(days: number): StallLevel {
  if (days <= 3) return "fresh";
  if (days <= 13) return "cooling";
  if (days <= 59) return "stalled";
  return "frozen";
}

/**
 * Projects finish date for a book in progress.
 * Returns null when there is no recent activity to base a projection on,
 * or when the book has no remaining pages.
 *
 * Window strategy: prefer last 14 days, fall back to last 30 days if too sparse.
 */
export function projectFinish(
  book: BookData,
  logs: ReadingLogData[],
  today: string,
): FinishProjection | null {
  const remaining = Math.max(0, (book.totalPages || 0) - (book.pagesRead || 0));
  if (remaining <= 0) return null;

  const bookLogs = logs.filter((l) => l.bookId === book.id);
  if (bookLogs.length === 0) return null;

  const tryWindow = (windowDays: number): FinishProjection | null => {
    const cutoff = addDays(today, -windowDays + 1);
    const inWindow = bookLogs.filter((l) => l.date >= cutoff && l.date <= today);
    const pages = inWindow.reduce((sum, l) => sum + (l.pagesRead || 0), 0);
    if (pages <= 0) return null;
    const activeDays = new Set(inWindow.map((l) => l.date)).size;
    const pagesPerDay = pages / windowDays;
    const daysToFinish = Math.ceil(remaining / pagesPerDay);
    return {
      pagesPerDay,
      daysToFinish,
      etaDate: addDays(today, daysToFinish),
      windowDays,
      activeDaysInWindow: activeDays,
    };
  };

  return tryWindow(14) ?? tryWindow(30);
}

export function formatEta(etaDate: string, today: string): string {
  const days = diffDays(etaDate, today);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `in ${days}d`;
  // Same year: "May 28" — different year: "May 28, 2027"
  const eta = new Date(etaDate);
  const sameYear = eta.getFullYear() === new Date(today).getFullYear();
  return eta.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}
