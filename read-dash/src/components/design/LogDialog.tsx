import { useEffect, useState } from "react";
import type { BookData } from "@/contexts/BooksContext";
import { Icon } from "./Icons";

interface SubmitPayload {
  bookId: string;
  date: string;
  startPage: number;
  endPage: number;
  pages: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  books: BookData[];
  defaultBookId: string | null;
  defaultDate: string;
  onSubmit: (payload: SubmitPayload) => void;
}

export function LogDialog({ open, onClose, books, defaultBookId, defaultDate, onSubmit }: Props) {
  const reading = books.filter((b) => b.status === "reading");
  const [bookId, setBookId] = useState<string>("");
  const [date, setDate] = useState<string>(defaultDate);
  const [startPage, setStartPage] = useState<string>("");
  const [endPage, setEndPage] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const initial = defaultBookId || (reading[0] && reading[0].id) || "";
    setBookId(initial);
    setDate(defaultDate);
    const book = books.find((b) => b.id === initial);
    setStartPage(book ? String(book.pagesRead) : "");
    setEndPage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBookId, defaultDate]);

  useEffect(() => {
    const book = books.find((b) => b.id === bookId);
    if (book) setStartPage(String(book.pagesRead));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  if (!open) return null;

  const sp = parseInt(startPage, 10) || 0;
  const ep = parseInt(endPage, 10) || 0;
  const pages = Math.max(0, ep - sp);
  const valid = bookId && ep > sp;
  const selectedBook = books.find((b) => b.id === bookId);

  return (
    <div className="irm-dialog__backdrop" onClick={onClose}>
      <div className="irm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="irm-dialog__head">
          <h3>Log reading session</h3>
          <button className="irm-iconbtn" onClick={onClose}>
            <Icon.X size={16} />
          </button>
        </div>
        <div className="irm-dialog__body">
          <label className="irm-field">
            <span className="irm-field__label">Book</span>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="irm-input">
              {reading.length === 0 && <option value="">No books currently reading</option>}
              {reading.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>

          <div className="irm-field-row">
            <label className="irm-field">
              <span className="irm-field__label">Start page</span>
              <input
                type="number"
                value={startPage}
                onChange={(e) => setStartPage(e.target.value)}
                className="irm-input irm-mono"
              />
            </label>
            <label className="irm-field">
              <span className="irm-field__label">End page</span>
              <input
                type="number"
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
                className="irm-input irm-mono"
                placeholder="—"
                autoFocus
              />
            </label>
          </div>

          <label className="irm-field">
            <span className="irm-field__label">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="irm-input irm-mono"
            />
          </label>

          <div className="irm-dialog__preview">
            <Icon.Book size={14} />
            <span className="irm-mono">{pages}</span> pages
            {pages > 0 && selectedBook && (
              <span className="irm-dialog__preview-book">· {selectedBook.title}</span>
            )}
          </div>
        </div>
        <div className="irm-dialog__foot">
          <button className="irm-btn irm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="irm-btn irm-btn--primary"
            disabled={!valid}
            onClick={() => {
              onSubmit({ bookId, date, startPage: sp, endPage: ep, pages });
              onClose();
            }}
          >
            <Icon.Check size={14} /> Save session
          </button>
        </div>
      </div>
    </div>
  );
}
