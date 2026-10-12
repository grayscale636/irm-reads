import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUnthemedNotes, setNoteThemes, type Theme, type UnthemedNote } from "@/lib/api";
import { ThemePicker } from "./ThemePicker";

interface Props {
  themes: Theme[];
  onLabelled: () => void;
}

// Review queue: notes without a theme, each with suggestions to accept in one click.
export function UnthemedQueue({ themes, onLabelled }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<UnthemedNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getUnthemedNotes().then(setItems).catch((e) => setError(e.message));
  }, []);

  const label = async (id: string, slugs: string[], dismiss = false) => {
    if (!slugs.length && !dismiss) return;
    await setNoteThemes(id, slugs, dismiss);
    setItems((prev) => prev?.filter((n) => n.id !== id) ?? null);
    onLabelled();
  };

  if (error) return <div className="irm-empty__text" style={{ color: "#dc2626" }}>{error}</div>;
  if (!items) return <div className="irm-loading"><div className="irm-spinner" /></div>;
  if (items.length === 0) {
    return (
      <div className="irm-card irm-empty" style={{ minHeight: 200 }}>
        <div className="irm-empty__text">Every note has a theme.</div>
      </div>
    );
  }

  return (
    <div className="irm-unthemed">
      {items.map((n) => {
        const hidden = n.isSpoiler && !revealed.has(n.id);
        return (
          <section key={n.id} className="irm-card irm-unthemed__item">
            <button className="irm-themes__workhead" onClick={() => navigate(`/book/${n.bookId}`)}>
              <span className="irm-themes__kind">{n.mediaType === "game" ? "Game" : "Book"}</span>
              <span className="irm-themes__title">{n.bookTitle}</span>
              {n.ref && <span className="irm-themes__author">{n.ref}</span>}
            </button>
            {hidden ? (
              <button className="irm-btn irm-btn--ghost" style={{ justifySelf: "start" }} onClick={() => setRevealed((s) => new Set(s).add(n.id))}>
                Show spoiler
              </button>
            ) : (
              <p className="irm-note__text">{n.text}</p>
            )}
            <ThemePicker themes={themes} value={[]} suggestions={n.suggestions} onChange={(next) => label(n.id, next)} />
            <button
              className="irm-related__toggle"
              style={{ justifySelf: "start" }}
              onClick={() => label(n.id, [], true)}
              title="Plot recap, gameplay remark, etc. — remove from this queue"
            >
              No theme
            </button>
          </section>
        );
      })}
    </div>
  );
}
