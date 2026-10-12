import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSemanticMap, getThemes, type SemanticMapData, type SemanticPoint, type Theme } from "@/lib/api";
import { Icon } from "./Icons";

type Media = "all" | "books" | "games";

interface Props {
  media: Media;
  /** Rendered top-left above the map's own controls (mode + media switches). */
  controls: React.ReactNode;
}

const MEDIA_COLOR = { book: "#E69F00", game: "#D55E00" } as const;
const PAD = 40;

// Notes placed by meaning: nearby points say similar things, whatever the work.
// Only neighbourhoods are meaningful — distances between far clusters are not.
export function SemanticMap({ media, controls }: Props) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<SemanticMapData | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [theme, setTheme] = useState<string>("");
  const [showLinks, setShowLinks] = useState(true);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  useEffect(() => {
    getSemanticMap().then(setData).catch((e) => setError(e.message));
    getThemes().then(setThemes).catch(() => setThemes([]));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom around the cursor (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(8, Math.max(0.5, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return { k, tx: mx - (mx - v.tx) * (k / v.k), ty: my - (my - v.ty) * (k / v.k) };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const points = useMemo(
    () => (data?.points || []).filter((p) => (media === "all" ? true : media === "games" ? p.mediaType === "game" : p.mediaType === "book")),
    [data, media],
  );
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const edges = useMemo(
    () => (data?.edges || []).filter((e) => byId.has(e.source) && byId.has(e.target)),
    [data, byId],
  );
  const neighbours = useMemo(() => {
    const m = new Map<string, Array<{ id: string; score: number }>>();
    for (const e of edges) {
      (m.get(e.source) || m.set(e.source, []).get(e.source)!).push({ id: e.target, score: e.score });
      (m.get(e.target) || m.set(e.target, []).get(e.target)!).push({ id: e.source, score: e.score });
    }
    for (const list of m.values()) list.sort((a, b) => b.score - a.score);
    return m;
  }, [edges]);

  const px = (p: SemanticPoint) => PAD + p.x * (size.w - PAD * 2);
  const py = (p: SemanticPoint) => PAD + p.y * (size.h - PAD * 2);

  const focusId = selectedId || hoverId;
  const focusSet = useMemo(() => {
    if (!focusId) return null;
    return new Set([focusId, ...(neighbours.get(focusId) || []).map((n) => n.id)]);
  }, [focusId, neighbours]);
  const inTheme = (p: SemanticPoint) => !theme || p.themes.includes(theme);
  const dimmed = (p: SemanticPoint) => (focusSet ? !focusSet.has(p.id) : !inTheme(p));

  const detail = focusId ? byId.get(focusId) : undefined;
  useEffect(() => setRevealed(false), [focusId]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onPointerUp = () => {
    // A click on empty space (no drag) clears the selection.
    if (drag.current && !drag.current.moved) setSelectedId(null);
    drag.current = null;
  };

  return (
    <div
      className="irm-graph__canvas"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { drag.current = null; setHoverId(null); }}
    >
      {error ? (
        <div className="irm-empty" style={{ height: "100%" }}>
          <div className="irm-empty__text">{error}</div>
        </div>
      ) : !data ? (
        <div className="irm-loading" style={{ height: "100%" }}><div className="irm-spinner" /></div>
      ) : points.length < 3 ? (
        <div className="irm-empty" style={{ height: "100%" }}>
          <div className="irm-empty__text">Not enough notes to map yet.</div>
        </div>
      ) : (
        <svg width={size.w} height={size.h} className="irm-graph__svg">
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
            {showLinks && edges.map((e) => {
              const a = byId.get(e.source)!, b = byId.get(e.target)!;
              const lit = focusId && (e.source === focusId || e.target === focusId);
              const cross = a.bookId !== b.bookId;
              return (
                <line
                  key={`${e.source}|${e.target}`}
                  x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)}
                  className="irm-graph__link"
                  style={{
                    opacity: focusId ? (lit ? 0.9 : 0.04) : cross ? 0.35 : 0.12,
                    strokeWidth: (lit ? 1.6 : 1) / view.k,
                    strokeDasharray: cross ? undefined : `${3 / view.k} ${3 / view.k}`,
                  }}
                />
              );
            })}
            {points.map((p) => {
              const isFocus = p.id === focusId;
              return (
                <g key={p.id}>
                  <circle
                    cx={px(p)} cy={py(p)}
                    r={(isFocus ? 7 : 5) / view.k}
                    fill={theme && !inTheme(p) && !focusSet ? "var(--ink-faint, #9ca3af)" : MEDIA_COLOR[p.mediaType]}
                    stroke={isFocus ? "var(--ink)" : "var(--bg-elev)"}
                    strokeWidth={1.2 / view.k}
                    style={{ opacity: dimmed(p) ? 0.18 : 1, cursor: "pointer", transition: "opacity 0.15s" }}
                    onPointerEnter={() => setHoverId(p.id)}
                    onPointerLeave={() => setHoverId((h) => (h === p.id ? null : h))}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => { e.stopPropagation(); setSelectedId((s) => (s === p.id ? null : p.id)); }}
                  />
                  {isFocus && (
                    <text x={px(p) + 9 / view.k} y={py(p) + 4 / view.k} className="irm-graph__label" style={{ fontSize: 12 / view.k }}>
                      {p.bookTitle}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}

      <div className="irm-graph__controls" onPointerDown={(e) => e.stopPropagation()}>
        {controls}
        <div className="irm-graph__legend">
          <span className="irm-graph__legend-item" style={{ cursor: "default" }}>
            <span className="irm-graph__swatch" style={{ background: MEDIA_COLOR.book }} /> Book note
          </span>
          <span className="irm-graph__legend-item" style={{ cursor: "default" }}>
            <span className="irm-graph__swatch" style={{ background: MEDIA_COLOR.game }} /> Game note
          </span>
          <button className={`irm-graph__legend-item${showLinks ? "" : " is-off"}`} onClick={() => setShowLinks((v) => !v)}>
            Similar links
          </button>
          <select
            className="irm-sort__select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            title="Highlight one theme"
          >
            <option value="">Highlight theme…</option>
            {themes.filter((t) => t.noteCount > 0).map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {detail && (
        <div className="irm-graph__inspector" onPointerDown={(e) => e.stopPropagation()}>
          <div className="irm-graph__inspector-head">
            <span className="irm-graph__swatch" style={{ background: MEDIA_COLOR[detail.mediaType] }} />
            <span className="irm-graph__inspector-title">{detail.bookTitle}</span>
            <span className="irm-graph__inspector-type irm-mono">{detail.mediaType === "game" ? "Game" : "Book"}</span>
          </div>
          {detail.isSpoiler && !revealed ? (
            <button className="irm-btn irm-btn--ghost" onClick={() => setRevealed(true)} disabled={!selectedId} title={selectedId ? undefined : "Click the point first"}>
              {selectedId ? "Show spoiler" : "Spoiler — click the point to reveal"}
            </button>
          ) : (
            <p className="irm-graph__inspector-meta">{detail.text}</p>
          )}
          {(neighbours.get(detail.id) || []).length > 0 && (
            <div className="irm-graph__inspector-rows">
              <span className="irm-graph__inspector-row-label">Most similar</span>
              {(neighbours.get(detail.id) || []).slice(0, 4).map((n) => {
                const q = byId.get(n.id)!;
                return (
                  <button
                    key={n.id}
                    className="irm-graph__inspector-row irm-semantic__neighbour"
                    onClick={() => setSelectedId(n.id)}
                    title={q.isSpoiler ? "Spoiler" : q.text}
                  >
                    <span className="irm-graph__inspector-row-label">
                      {q.bookTitle}{q.isSpoiler ? " · spoiler" : ""}
                    </span>
                    <span className="irm-graph__inspector-row-val irm-mono">{n.score.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="irm-btn irm-btn--ghost irm-graph__inspector-open"
            onClick={() => navigate(`/book/${detail.bookId}`)}
          >
            Open {detail.mediaType === "game" ? "game" : "book"} <Icon.ChevronRight size={14} />
          </button>
        </div>
      )}

      <div className="irm-graph__hint irm-mono">
        nearby = similar meaning · solid line = across works · click a point to pin
      </div>
    </div>
  );
}
