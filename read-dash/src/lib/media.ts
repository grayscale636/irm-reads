import type { Book, MediaType } from "./api";

type Status = Book["status"];

// Status wording per media type. Statuses are shared; only the words differ.
const STATUS_LABELS: Record<MediaType, Record<Status, string>> = {
  book: {
    "want-to-read": "Want to read",
    reading: "Reading",
    paused: "Paused",
    completed: "Completed",
    dnf: "DNF",
  },
  game: {
    "want-to-read": "Want to play",
    reading: "Playing",
    paused: "Paused",
    completed: "Finished",
    dnf: "Dropped",
  },
};

/** Order statuses appear in dropdowns. */
export const STATUS_ORDER: Status[] = ["want-to-read", "reading", "paused", "completed", "dnf"];

export function statusLabel(status: Status, mediaType: MediaType = "book"): string {
  return STATUS_LABELS[mediaType][status];
}

/** Dropdown wording — spells out DNF for books. */
export function statusOptionLabel(status: Status, mediaType: MediaType = "book"): string {
  return status === "dnf" && mediaType === "book" ? "DNF (Did not finish)" : statusLabel(status, mediaType);
}

/**
 * Total minutes played. Steam games use the synced Steam playtime; manual games
 * accumulate logged sessions in metadata.playtime_minutes; older rows fall back
 * to whole hours in pagesRead.
 */
export function playMinutes(book: Pick<Book, "pagesRead" | "metadata">): number {
  const m = (book.metadata || {}) as Record<string, unknown>;
  const steam = Number(m.steam_playtime_minutes);
  if (Number.isFinite(steam) && m.steam_appid != null) return steam;
  const manual = Number(m.playtime_minutes);
  if (Number.isFinite(manual)) return manual;
  return (book.pagesRead || 0) * 60;
}

export const isSteamGame = (book: Pick<Book, "metadata">) =>
  ((book.metadata || {}) as Record<string, unknown>).steam_appid != null;

/** "19.3 h" — one decimal, no trailing ".0". */
export function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)} h`;
}
