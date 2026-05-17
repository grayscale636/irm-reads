import { useEffect, useState } from "react";
import type { BookData } from "@/contexts/BooksContext";
import { Icon } from "./Icons";
import { StarRating } from "./StarRating";

type NewBook = Omit<BookData, "id">;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (book: NewBook) => void;
  today: string;
}

export function AddBookDialog({ open, onClose, onSubmit, today }: Props) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
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
    setTotalPages("");
    setStatus("want-to-read");
    setPagesRead("");
    setStartedAt("");
    setFinishedAt("");
    setRating(0);
  }, [open]);

  if (!open) return null;

  const tp = parseInt(totalPages, 10);
  const valid = title.trim() && author.trim() && tp > 0;

  const handleSubmit = () => {
    if (!valid) return;
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
    });
    onClose();
  };

  return (
    <div className="irm-dialog__backdrop" onClick={onClose}>
      <div className="irm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="irm-dialog__head">
          <h3>Add a book</h3>
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
            <span className="irm-field__label">Author</span>
            <input className="irm-input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <div className="irm-field-row">
            <label className="irm-field">
              <span className="irm-field__label">Total pages</span>
              <input
                type="number"
                className="irm-input irm-mono"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
              />
            </label>
            <label className="irm-field">
              <span className="irm-field__label">Status</span>
              <select
                className="irm-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookData["status"])}
              >
                <option value="want-to-read">Want to read</option>
                <option value="reading">Reading</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="dnf">DNF (Did not finish)</option>
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
            <Icon.Check size={14} /> Add book
          </button>
        </div>
      </div>
    </div>
  );
}
