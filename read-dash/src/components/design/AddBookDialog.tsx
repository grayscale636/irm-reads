import { useEffect, useState } from "react";
import type { BookData } from "@/contexts/BooksContext";
import { Icon } from "./Icons";
import { StarRating } from "./StarRating";
import { STATUS_ORDER, statusOptionLabel } from "@/lib/media";

type NewBook = Omit<BookData, "id">;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (book: NewBook) => void;
  today: string;
  defaultMediaType?: "book" | "game";
}

export function AddBookDialog({ open, onClose, onSubmit, today, defaultMediaType = "book" }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [mediaType, setMediaType] = useState<"book" | "game">("book");
  const [platform, setPlatform] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [status, setStatus] = useState<BookData["status"]>("want-to-read");
  const [pagesRead, setPagesRead] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [finishedAt, setFinishedAt] = useState("");
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setAuthor("");
    setMediaType(defaultMediaType);
    setPlatform("");
    setTotalPages("");
    setStatus("want-to-read");
    setPagesRead("");
    setStartedAt("");
    setFinishedAt("");
    setRating(0);
  }, [open]);

  if (!open) return null;

  const isGame = mediaType === "game";
  const tp = parseInt(totalPages, 10);
  // Games have no length/target — only optional hours played so far.
  const valid = title.trim() && author.trim() && (isGame || tp > 0);

  const handleSubmit = () => {
    if (!valid) return;
    if (isGame) {
      const minutes = Math.max(0, Math.round((parseFloat(pagesRead) || 0) * 60));
      onSubmit({
        title: title.trim(),
        author: author.trim(),
        cover: "",
        totalPages: 0,
        pagesRead: Math.floor(minutes / 60),
        progress: 0,
        status,
        rating: status === "completed" ? rating : 0,
        startedAt: status === "want-to-read" ? undefined : (startedAt || today),
        finishedAt: status === "completed" ? (finishedAt || today) : undefined,
        reflection: "",
        quotes: [],
        mediaType: "game",
        progressUnit: "hour",
        metadata: { platform: platform.trim() || undefined, playtime_minutes: minutes },
      });
      onClose();
      return;
    }
    let pr = parseInt(pagesRead, 10) || 0;
    if (status === "completed") pr = tp;
    if (status === "want-to-read") pr = 0;
    pr = Math.max(0, Math.min(tp, pr));
    const progress = tp > 0 ? Math.round((pr / tp) * 100) : 0;
    const needsStarted =
      status === "reading" || status === "paused" || status === "dnf" || status === "completed";
    onSubmit({
      title: title.trim(),
      author: author.trim(),
      cover: "",
      totalPages: tp,
      pagesRead: pr,
      progress,
      status,
      rating: status === "completed" ? rating : 0,
      startedAt: needsStarted ? (startedAt || today) : undefined,
      finishedAt: status === "completed" ? (finishedAt || today) : undefined,
      reflection: "",
      quotes: [],
      mediaType: "book",
      progressUnit: "page",
    });
    onClose();
  };

  return (
    <div className="irm-dialog__backdrop" onClick={onClose}>
      <div className="irm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="irm-dialog__head">
          <h3>{mediaType === "game" ? "Add a game" : "Add a book"}</h3>
          <button className="irm-iconbtn" onClick={onClose}>
            <Icon.X size={16} />
          </button>
        </div>
        <div className="irm-dialog__body">
          <label className="irm-field">
            <span className="irm-field__label">Title</span>
            <input className="irm-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label className="irm-field">
            <span className="irm-field__label">{mediaType === "game" ? "Developer / Publisher" : "Author"}</span>
            <input className="irm-input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <div className="irm-field-row">
            <label className="irm-field">
              <span className="irm-field__label">Type</span>
              <select
                className="irm-input"
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as "book" | "game")}
              >
                <option value="book">Book</option>
                <option value="game">Game</option>
              </select>
            </label>
            {mediaType === "game" && (
              <label className="irm-field">
                <span className="irm-field__label">Platform</span>
                <input
                  className="irm-input"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="PC / PS5 / Switch…"
                />
              </label>
            )}
          </div>
          <div className="irm-field-row">
            {isGame ? (
              <label className="irm-field">
                <span className="irm-field__label">Hours played (optional)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className="irm-input irm-mono"
                  value={pagesRead}
                  onChange={(e) => setPagesRead(e.target.value)}
                  placeholder="0"
                />
              </label>
            ) : (
              <label className="irm-field">
                <span className="irm-field__label">Total pages</span>
                <input
                  type="number"
                  className="irm-input irm-mono"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                />
              </label>
            )}
            <label className="irm-field">
              <span className="irm-field__label">Status</span>
              <select
                className="irm-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookData["status"])}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{statusOptionLabel(s, mediaType)}</option>
                ))}
              </select>
            </label>
          </div>
          {(status === "reading" || status === "paused" || status === "dnf") && (
            <div className="irm-field-row">
              <label className="irm-field">
                <span className="irm-field__label">Date started</span>
                <input
                  type="date"
                  className="irm-input irm-mono"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </label>
              {!isGame && (
                <label className="irm-field">
                  <span className="irm-field__label">Pages read</span>
                  <input
                    type="number"
                    className="irm-input irm-mono"
                    value={pagesRead}
                    onChange={(e) => setPagesRead(e.target.value)}
                    placeholder="0"
                  />
                </label>
              )}
            </div>
          )}
          {status === "completed" && (
            <>
              <div className="irm-field-row">
                <label className="irm-field">
                  <span className="irm-field__label">Started</span>
                  <input
                    type="date"
                    className="irm-input irm-mono"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                  />
                </label>
                <label className="irm-field">
                  <span className="irm-field__label">Finished</span>
                  <input
                    type="date"
                    className="irm-input irm-mono"
                    value={finishedAt}
                    onChange={(e) => setFinishedAt(e.target.value)}
                  />
                </label>
              </div>
              <div className="irm-field">
                <span className="irm-field__label">Rating</span>
                <StarRating value={rating} onChange={setRating} />
              </div>
            </>
          )}


        </div>
        <div className="irm-dialog__foot">
          <button className="irm-btn irm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="irm-btn irm-btn--primary" disabled={!valid} onClick={handleSubmit}>
            <Icon.Check size={14} /> Add {mediaType === "game" ? "game" : "book"}
          </button>
        </div>
      </div>
    </div>
  );
}
