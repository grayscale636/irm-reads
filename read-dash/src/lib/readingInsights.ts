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
    // Displayed pace = average across days the reader actually read — matches
    // what a user feels their "pace" is. Calendar ETA still uses the full window
    // so projected finish date accounts for off-days, not just reading days.
    const pagesPerDay = pages / Math.max(1, activeDays);
    const calendarRate = pages / windowDays;
    const daysToFinish = Math.ceil(remaining / Math.max(0.01, calendarRate));
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

export interface YearPace {
  year: number;
  daysElapsed: number;
  daysTotal: number;
  booksThisYear: number;
  pagesThisYear: number;
  projectedBooks: number;
  projectedPages: number;
}

export function yearPace(
  books: BookData[],
  logs: ReadingLogData[],
  today: string,
): YearPace {
  const todayD = toDate(today);
  const year = todayD.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysTotal = isLeap ? 366 : 365;
  const daysElapsed = Math.max(1, Math.round((todayD.getTime() - jan1.getTime()) / MS_PER_DAY) + 1);

  const yearPrefix = `${year}-`;
  const booksThisYear = books.filter(
    (b) => b.status === "completed" && b.finishedAt?.startsWith(yearPrefix),
  ).length;
  const pagesThisYear = logs
    .filter((l) => l.date.startsWith(yearPrefix) && l.date <= today)
    .reduce((sum, l) => sum + (l.pagesRead || 0), 0);

  const scale = daysTotal / daysElapsed;
  return {
    year,
    daysElapsed,
    daysTotal,
    booksThisYear,
    pagesThisYear,
    projectedBooks: Math.round(booksThisYear * scale),
    projectedPages: Math.round(pagesThisYear * scale),
  };
}

export interface PersonalRecords {
  bestDay: { date: string; pages: number } | null;
  longestSession: { date: string; pages: number; bookId: string } | null;
  fastestBook: { title: string; days: number; pages: number } | null;
  longestStreak: number;
}

export function personalRecords(
  books: BookData[],
  logs: ReadingLogData[],
): PersonalRecords {
  // Best day = highest summed pages across a single date
  const byDate: Record<string, number> = {};
  for (const l of logs) {
    byDate[l.date] = (byDate[l.date] || 0) + (l.pagesRead || 0);
  }
  let bestDay: PersonalRecords["bestDay"] = null;
  for (const [date, pages] of Object.entries(byDate)) {
    if (!bestDay || pages > bestDay.pages) bestDay = { date, pages };
  }

  // Longest single session
  let longestSession: PersonalRecords["longestSession"] = null;
  for (const l of logs) {
    if (!longestSession || (l.pagesRead || 0) > longestSession.pages) {
      longestSession = { date: l.date, pages: l.pagesRead || 0, bookId: l.bookId };
    }
  }

  // Fastest finished book (fewest days from start to finish)
  let fastestBook: PersonalRecords["fastestBook"] = null;
  for (const b of books) {
    if (b.status !== "completed" || !b.startedAt || !b.finishedAt) continue;
    const days = Math.max(1, diffDays(b.finishedAt, b.startedAt) + 1);
    if (!fastestBook || days < fastestBook.days) {
      fastestBook = { title: b.title, days, pages: b.totalPages || 0 };
    }
  }

  // Longest streak across all history
  const dates = Object.keys(byDate).sort();
  let longestStreak = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const d of dates) {
    if (prev && diffDays(d, prev) === 1) {
      cur += 1;
    } else {
      cur = 1;
    }
    if (cur > longestStreak) longestStreak = cur;
    prev = d;
  }

  return { bestDay, longestSession, fastestBook, longestStreak };
}

export interface AuthorBreakdown {
  author: string;
  pages: number;
  books: number;
}

export function topAuthors(
  books: BookData[],
  limit = 5,
): AuthorBreakdown[] {
  const map = new Map<string, AuthorBreakdown>();
  for (const b of books) {
    const key = (b.author || "Unknown").trim() || "Unknown";
    const entry = map.get(key) ?? { author: key, pages: 0, books: 0 };
    entry.pages += b.pagesRead || 0;
    entry.books += 1;
    map.set(key, entry);
  }
  return Array.from(map.values())
    .filter((a) => a.pages > 0)
    .sort((a, b) => b.pages - a.pages)
    .slice(0, limit);
}

export interface YearSummary {
  year: number;
  daysElapsed: number;
  daysTotal: number;
  booksFinished: number;
  pagesRead: number;
  uniqueAuthors: number;
  bestMonth: { month: number; pages: number } | null;
  bestDay: { date: string; pages: number } | null;
  longestStreak: number;
  topAuthor: { author: string; pages: number; books: number } | null;
  fastestBook: { title: string; days: number } | null;
  averagePagesPerActiveDay: number;
  activeDays: number;
}

export function yearSummary(
  books: BookData[],
  logs: ReadingLogData[],
  today: string,
): YearSummary {
  const todayD = toDate(today);
  const year = todayD.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysTotal = isLeap ? 366 : 365;
  const daysElapsed = Math.max(1, Math.round((todayD.getTime() - jan1.getTime()) / MS_PER_DAY) + 1);
  const prefix = `${year}-`;

  const yearLogs = logs.filter((l) => l.date.startsWith(prefix) && l.date <= today);
  const pagesRead = yearLogs.reduce((s, l) => s + (l.pagesRead || 0), 0);

  // Aggregate by month and by day
  const byMonth: Record<number, number> = {};
  const byDay: Record<string, number> = {};
  for (const l of yearLogs) {
    const m = parseInt(l.date.slice(5, 7), 10);
    byMonth[m] = (byMonth[m] || 0) + (l.pagesRead || 0);
    byDay[l.date] = (byDay[l.date] || 0) + (l.pagesRead || 0);
  }
  let bestMonth: YearSummary["bestMonth"] = null;
  for (const [m, pages] of Object.entries(byMonth)) {
    if (!bestMonth || pages > bestMonth.pages) bestMonth = { month: parseInt(m, 10), pages };
  }
  let bestDay: YearSummary["bestDay"] = null;
  for (const [date, pages] of Object.entries(byDay)) {
    if (!bestDay || pages > bestDay.pages) bestDay = { date, pages };
  }

  // Longest streak within this year
  const sortedDates = Object.keys(byDay).sort();
  let longestStreak = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const d of sortedDates) {
    if (prev && diffDays(d, prev) === 1) cur += 1;
    else cur = 1;
    if (cur > longestStreak) longestStreak = cur;
    prev = d;
  }

  // Books finished this year
  const yearBooks = books.filter((b) => b.status === "completed" && b.finishedAt?.startsWith(prefix));

  // Author breakdown by pages-this-year (logs joined to book)
  const bookAuthor = new Map(books.map((b) => [b.id, (b.author || "Unknown").trim() || "Unknown"]));
  const authorPages = new Map<string, { pages: number; bookIds: Set<string> }>();
  for (const l of yearLogs) {
    const a = bookAuthor.get(l.bookId);
    if (!a) continue;
    const entry = authorPages.get(a) ?? { pages: 0, bookIds: new Set<string>() };
    entry.pages += l.pagesRead || 0;
    entry.bookIds.add(l.bookId);
    authorPages.set(a, entry);
  }
  let topAuthor: YearSummary["topAuthor"] = null;
  for (const [author, { pages, bookIds }] of authorPages.entries()) {
    if (!topAuthor || pages > topAuthor.pages) {
      topAuthor = { author, pages, books: bookIds.size };
    }
  }

  // Fastest book finished this year (min span days)
  let fastestBook: YearSummary["fastestBook"] = null;
  for (const b of yearBooks) {
    if (!b.startedAt || !b.finishedAt) continue;
    const days = Math.max(1, diffDays(b.finishedAt, b.startedAt) + 1);
    if (!fastestBook || days < fastestBook.days) {
      fastestBook = { title: b.title, days };
    }
  }

  const activeDays = Object.keys(byDay).length;
  const averagePagesPerActiveDay = activeDays > 0 ? Math.round(pagesRead / activeDays) : 0;

  return {
    year,
    daysElapsed,
    daysTotal,
    booksFinished: yearBooks.length,
    pagesRead,
    uniqueAuthors: authorPages.size,
    bestMonth,
    bestDay,
    longestStreak,
    topAuthor,
    fastestBook,
    averagePagesPerActiveDay,
    activeDays,
  };
}

export interface FinishedSpan {
  id: string;
  title: string;
  author: string;
  startedAt: string;
  finishedAt: string;
  days: number;
  totalPages: number;
}

export function finishedSpans(books: BookData[], limit = 12): FinishedSpan[] {
  return books
    .filter((b) => b.status === "completed" && b.startedAt && b.finishedAt)
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      startedAt: b.startedAt!,
      finishedAt: b.finishedAt!,
      days: Math.max(1, diffDays(b.finishedAt!, b.startedAt!) + 1),
      totalPages: b.totalPages || 0,
    }))
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    .slice(0, limit);
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
