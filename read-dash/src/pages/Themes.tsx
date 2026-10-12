import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getThemes, getThemeNotes, type Theme, type ThemeNote } from "@/lib/api";

// Theme → work → note: browse books and games by what they're about.
export default function Themes() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [notes, setNotes] = useState<ThemeNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getThemes(true).then(setThemes).catch((e) => setError(e.message));
  }, []);

  // Default to the theme with the most notes.
  const selected = useMemo(() => {
    const t = params.get("t");
    if (t) return t;
    if (!themes?.length) return null;
    return [...themes].sort((a, b) => b.noteCount - a.noteCount)[0].slug;
  }, [params, themes]);

  useEffect(() => {
    if (!selected) return;
    setNotes(null);
    setRevealed(new Set());
    getThemeNotes(selected).then(setNotes).catch((e) => setError(e.message));
  }, [selected]);

  const theme = themes?.find((t) => t.slug === selected);
  const works = useMemo(() => {
    const map = new Map<string, { note: ThemeNote; notes: ThemeNote[] }>();
    for (const n of notes || []) {
      const w = map.get(n.bookId);
      if (w) w.notes.push(n);
      else map.set(n.bookId, { note: n, notes: [n] });
    }
    // Most-discussed works first.
    return [...map.values()].sort((a, b) => b.notes.length - a.notes.length);
  }, [notes]);

  const spoilerIds = (notes || []).filter((n) => n.isSpoiler).map((n) => n.id);
  const allShown = spoilerIds.length > 0 && spoilerIds.every((id) => revealed.has(id));
  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="irm-main">
      <div className="irm-page-head">
        <div>
          <p className="irm-eyebrow">Themes</p>
          <h1 className="irm-page-title">{theme?.name || "Themes"}</h1>
          <p className="irm-page-sub">
            {theme
              ? <>{theme.description} · <span className="irm-mono">{theme.noteCount}</span> notes across <span className="irm-mono">{theme.workCount}</span> works</>
              : "What your books and games keep coming back to."}
          </p>
        </div>
        {spoilerIds.length > 0 && (
          <button
            className="irm-btn irm-btn--ghost"
            onClick={() => setRevealed(allShown ? new Set() : new Set(spoilerIds))}
          >
            {allShown ? "Hide all spoilers" : "Show all spoilers"}
          </button>
        )}
      </div>

      {error && <div className="irm-empty__text" style={{ color: "#dc2626" }}>{error}</div>}

      <div className="irm-themes__chips">
        {(themes || []).map((t) => (
          <button
            key={t.slug}
            className={`irm-themes__chip${t.slug === selected ? " is-active" : ""}`}
            onClick={() => setParams({ t: t.slug }, { replace: true })}
            disabled={t.noteCount === 0}
            title={t.description || undefined}
          >
            {t.name} <span className="irm-mono">{t.noteCount}</span>
          </button>
        ))}
      </div>

      {!notes ? (
        <div className="irm-loading"><div className="irm-spinner" /></div>
      ) : works.length === 0 ? (
        <div className="irm-card irm-empty" style={{ minHeight: 200 }}>
          <div className="irm-empty__text">No notes in this theme yet.</div>
        </div>
      ) : (
        <div className="irm-themes__works">
          {works.map(({ note: w, notes: ns }) => (
            <section key={w.bookId} className="irm-card irm-themes__work">
              <button className="irm-themes__workhead" onClick={() => navigate(`/book/${w.bookId}`)}>
                <span className="irm-themes__kind">{w.mediaType === "game" ? "Game" : "Book"}</span>
                <span className="irm-themes__title">{w.bookTitle}</span>
                <span className="irm-themes__author">{w.bookAuthor}</span>
                <span className="irm-mono irm-themes__count">{ns.length}</span>
              </button>
              <ul className="irm-themes__notes">
                {ns.map((n) => {
                  const hidden = n.isSpoiler && !revealed.has(n.id);
                  return (
                    <li key={n.id} className="irm-themes__note">
                      {n.ref && <span className="irm-note__page irm-mono">{n.ref}</span>}
                      {n.isSpoiler && (
                        <button className="irm-btn irm-btn--ghost irm-themes__reveal" onClick={() => toggle(n.id)}>
                          {hidden ? "Show spoiler" : "Hide spoiler"}
                        </button>
                      )}
                      {!hidden && <p className="irm-note__text">{n.text}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
