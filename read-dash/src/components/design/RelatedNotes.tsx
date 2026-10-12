import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRelatedNotes, type RelatedNote } from "@/lib/api";

interface Props {
  noteId: string;
}

// Lazily loads the most similar notes from *other* books/games.
export function RelatedNotes({ noteId }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RelatedNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !items) {
      try {
        setItems(await getRelatedNotes(noteId, 5));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
  };

  return (
    <div className="irm-related">
      <button type="button" className="irm-related__toggle" onClick={toggle}>
        {open ? "Hide related" : "Related in other works"}
      </button>
      {open && (
        <ul className="irm-related__list">
          {error && <li className="irm-related__empty">{error}</li>}
          {!error && !items && <li className="irm-related__empty">Loading…</li>}
          {items && items.length === 0 && (
            <li className="irm-related__empty">Nothing similar yet (very short notes aren't indexed).</li>
          )}
          {items?.map((r) => {
            const hidden = r.isSpoiler && !revealed.has(r.id);
            return (
              <li key={r.id} className="irm-related__item">
                <button type="button" className="irm-related__work" onClick={() => navigate(`/book/${r.bookId}`)}>
                  <span className="irm-themes__kind">{r.mediaType === "game" ? "Game" : "Book"}</span>
                  <span className="irm-related__title">{r.bookTitle}</span>
                  <span className="irm-mono irm-related__score">{r.score.toFixed(2)}</span>
                </button>
                {hidden ? (
                  <button
                    type="button"
                    className="irm-related__toggle"
                    onClick={() => setRevealed((s) => new Set(s).add(r.id))}
                  >
                    Show spoiler
                  </button>
                ) : (
                  <p className="irm-related__text">{r.text}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
