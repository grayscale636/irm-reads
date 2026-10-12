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
