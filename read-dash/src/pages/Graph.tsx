import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useBooks } from "@/contexts/BooksContext";
import { getAllNotes, normalizeQuote, type JournalNote } from "@/lib/api";
import { Icon } from "@/components/design/Icons";
import { formatHours, playMinutes, statusLabel } from "@/lib/media";
import { SemanticMap } from "@/components/design/SemanticMap";

// Books and games are separate node types (authors vs developers likewise).
type NodeType = "author" | "book" | "developer" | "game" | "note" | "quote";
type Media = "all" | "books" | "games";

interface GNode extends SimulationNodeDatum {
  id: string;
  type: NodeType;
  label: string;
  r: number;
  bookId?: string;
  sub?: string;
}

type GLink = SimulationLinkDatum<GNode>;

interface InspectorDetail {
  type: NodeType;
  title: string;
  meta: string;
  rows?: { label: string; value: string }[];
  bookId?: string;
}

const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  author: { label: "Author", color: "#0072B2" },
  book: { label: "Book", color: "#E69F00" },
  developer: { label: "Developer", color: "#56B4E9" },
  game: { label: "Game", color: "#D55E00" },
  note: { label: "Note", color: "#009E73" },
  quote: { label: "Quote", color: "#CC79A7" },
};

const ALL_TYPES: NodeType[] = ["author", "book", "developer", "game", "note", "quote"];
const BOOK_ONLY: NodeType[] = ["author", "book", "quote"];
const GAME_ONLY: NodeType[] = ["developer", "game"];

export default function Graph() {
  const navigate = useNavigate();
  const { books, isLoading } = useBooks();
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [visible, setVisible] = useState<Record<NodeType, boolean>>({
    author: true, book: true, developer: true, game: true, note: true, quote: true,
  });
  // Global Books/Games filter, kept in the URL like the library shelf.
  const [params, setParams] = useSearchParams();
  const media: Media = params.get("media") === "games" ? "games" : params.get("media") === "books" ? "books" : "all";
  // Network (relations) vs Semantic (notes placed by meaning); both kept in the URL.
  const viewMode: "network" | "semantic" = params.get("view") === "semantic" ? "semantic" : "network";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const setMedia = (m: Media) => setParam("media", m === "all" ? null : m);
  const shownTypes = ALL_TYPES.filter((t) =>
    media === "books" ? !GAME_ONLY.includes(t) : media === "games" ? !BOOK_ONLY.includes(t) : true,
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const viewInit = useRef(false);
  const fittedRef = useRef(false);
  const [headerH, setHeaderH] = useState(56);

  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  const [, forceRender] = useState(0);

  // Load reader notes once.
  useEffect(() => {
    let mounted = true;
    getAllNotes()
      .then((d) => { if (mounted) setNotes(d); })
      .catch(() => { /* silent */ })
      .finally(() => { if (mounted) setNotesLoaded(true); });
    return () => { mounted = false; };
  }, []);

  // Keep the graph page exactly one viewport tall (no page scroll) by
  // measuring the sticky header height.
  useEffect(() => {
    const measure = () => {
      const h = document.querySelector(".irm-header")?.getBoundingClientRect().height;
      if (h) setHeaderH(h);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Measure the canvas area. Re-run once data has loaded so the canvas (not
  // the loading spinner) is the observed element.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      if (!viewInit.current && r.width > 0) {
        setView({ tx: r.width / 2, ty: r.height / 2, k: 1 });
        viewInit.current = true;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, notesLoaded]);

  // Build the graph model (nodes + links) from books, notes, quotes.
  // Works in scope for the current Books/Games filter.
  const works = useMemo(
    () => books.filter((b) => (media === "all" ? true : media === "games" ? b.mediaType === "game" : b.mediaType !== "game")),
    [books, media],
  );

  const graph = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const workType = new Map<string, NodeType>();
    const creators = new Map<string, { type: NodeType; name: string; count: number }>();
    for (const b of works) {
      const isGame = b.mediaType === "game";
      workType.set(b.id, isGame ? "game" : "book");
      const type: NodeType = isGame ? "developer" : "author";
      const key = `${type}:${b.author}`;
      const c = creators.get(key);
      if (c) c.count++;
      else creators.set(key, { type, name: b.author, count: 1 });
    }

    const notesByBook = new Map<string, number>();
    for (const n of notes) notesByBook.set(n.bookId, (notesByBook.get(n.bookId) || 0) + 1);

    // Author / developer nodes — sized by how many of their works you have.
    for (const [key, c] of creators) {
      if (!visible[c.type]) continue;
      const unit = c.type === "developer" ? "game" : "book";
      nodes.push({
        id: key,
        type: c.type,
        label: c.name,
        r: 7 + Math.sqrt(c.count) * 4,
        sub: `${c.count} ${unit}${c.count === 1 ? "" : "s"}`,
      });
    }

    for (const b of works) {
      const type = workType.get(b.id)!;
      if (!visible[type]) continue;
      const noteCount = notesByBook.get(b.id) || 0;
      const quoteCount = (Array.isArray(b.quotes) ? b.quotes : []).length;
      const entries = noteCount + quoteCount;
      nodes.push({
        id: `book:${b.id}`,
        type,
        label: b.title,
        r: 6 + Math.sqrt(entries) * 3,
        bookId: b.id,
        sub: `${noteCount} notes · ${quoteCount} quotes`,
      });
      const creatorType: NodeType = type === "game" ? "developer" : "author";
      links.push({ source: `${creatorType}:${b.author}`, target: `book:${b.id}` });
    }

    if (visible.note) {
      for (const n of notes) {
        if (!workType.has(n.bookId)) continue;
        nodes.push({
          id: `note:${n.id}`,
          type: "note",
          // Never surface spoiler text on the canvas.
          label: n.isSpoiler ? "Spoiler" : n.text.slice(0, 40),
          r: 4,
          bookId: n.bookId,
          sub: n.bookTitle,
        });
        links.push({ source: `book:${n.bookId}`, target: `note:${n.id}` });
      }
    }

    if (visible.quote) {
      for (const b of works) {
        (Array.isArray(b.quotes) ? b.quotes : []).forEach((raw, idx) => {
          const q = normalizeQuote(raw);
          if (!q.text?.trim()) return;
          nodes.push({
            id: `quote:${b.id}:${idx}`,
            type: "quote",
            label: q.text.slice(0, 40),
            r: 4,
            bookId: b.id,
            sub: b.title,
          });
          links.push({ source: `book:${b.id}`, target: `quote:${b.id}:${idx}` });
        });
      }
    }

    // Drop links whose endpoints were filtered out.
    const ids = new Set(nodes.map((n) => n.id));
    const validLinks = links.filter(
      (l) => ids.has(l.source as string) && ids.has(l.target as string),
    );
    return { nodes, links: validLinks };
  }, [works, notes, visible]);

  // Adjacency for hover highlighting.
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!map.has(a)) map.set(a, new Set());
      map.get(a)!.add(b);
    };
    for (const l of graph.links) {
      const s = typeof l.source === "object" ? (l.source as GNode).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as GNode).id : (l.target as string);
      add(s, t);
      add(t, s);
    }
    return map;
  }, [graph]);

  // Fit the whole graph into the canvas once the layout settles, so nothing
  // gets clipped by the window edges.
  const fitToView = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ns = nodesRef.current.filter((n) => n.x != null && n.y != null);
    if (ns.length === 0) return;
    const pad = 64;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of ns) {
      minX = Math.min(minX, n.x! - n.r);
      maxX = Math.max(maxX, n.x! + n.r);
      minY = Math.min(minY, n.y! - n.r);
      maxY = Math.max(maxY, n.y! + n.r);
    }
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const r = el.getBoundingClientRect();
    const k = Math.min(4, Math.max(0.05, Math.min((r.width - pad * 2) / spanX, (r.height - pad * 2) / spanY)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({ k, tx: r.width / 2 - cx * k, ty: r.height / 2 - cy * k });
  }, []);

  // (Re)build the simulation whenever the graph model changes. Node objects are
  // reused across rebuilds so positions carry over and the layout stays stable.
  useEffect(() => {
    fittedRef.current = false;
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const nodes = graph.nodes.map((n) => {
      const p = prev.get(n.id);
      return p ? Object.assign(p, n) : n;
    });
    nodesRef.current = nodes;
    linksRef.current = graph.links.map((l) => ({ ...l }));

    const sim = forceSimulation(nodes)
      .force("link", forceLink<GNode, GLink>(linksRef.current)
        .id((d) => d.id)
        .distance((l) => {
          const t = (l.source as GNode).type;
          return t === "author" || t === "developer" ? 70 : 34;
        })
        .strength(0.5))
      .force("charge", forceManyBody<GNode>().strength((d) => -18 - d.r * 4))
      .force("collide", forceCollide<GNode>((d) => d.r + 3))
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(0.03))
      .force("y", forceY(0).strength(0.03))
      .on("tick", () => {
        forceRender((t) => t + 1);
        const s = simRef.current;
        if (!fittedRef.current && s && s.alpha() < 0.05) {
          fittedRef.current = true;
          fitToView();
        }
      });

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [graph, fitToView]);

  const toGraphCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.tx) / view.k,
        y: (clientY - rect.top - view.ty) / view.k,
      };
    },
    [view],
  );

  // ── Pointer interaction: node drag, background pan, click detection ──
  const drag = useRef<{
    kind: "node" | "pan" | null;
    node?: GNode;
    startX: number; startY: number;
    moved: boolean;
    origTx?: number; origTy?: number;
  }>({ kind: null, startX: 0, startY: 0, moved: false });

  const onNodePointerDown = (e: React.PointerEvent, node: GNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: "node", node, startX: e.clientX, startY: e.clientY, moved: false };
    simRef.current?.alphaTarget(0.3).restart();
  };

  const onBgPointerDown = (e: React.PointerEvent) => {
    drag.current = {
      kind: "pan", startX: e.clientX, startY: e.clientY, moved: false,
      origTx: view.tx, origTy: view.ty,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.kind) return;
    if (Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3) d.moved = true;
    if (d.kind === "node" && d.node) {
      const g = toGraphCoords(e.clientX, e.clientY);
      d.node.fx = g.x;
      d.node.fy = g.y;
    } else if (d.kind === "pan") {
      setView((v) => ({ ...v, tx: d.origTx! + (e.clientX - d.startX), ty: d.origTy! + (e.clientY - d.startY) }));
    }
  };

  const endDrag = () => {
    const d = drag.current;
    if (d.kind === "node" && d.node) {
      if (!d.moved && d.node.bookId) navigate(`/book/${d.node.bookId}`);
      d.node.fx = null;
      d.node.fy = null;
      simRef.current?.alphaTarget(0);
    }
    drag.current = { kind: null, startX: 0, startY: 0, moved: false };
  };

  // Native non-passive wheel listener so we can preventDefault and stop the
  // page from scrolling while zooming the graph.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const k = Math.min(4, Math.max(0.05, v.k * factor));
        return {
          k,
          tx: mx - (mx - v.tx) * (k / v.k),
          ty: my - (my - v.ty) * (k / v.k),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isLoading, notesLoaded]);

  const stats = useMemo(() => {
    const byCreator = new Map<string, number>();
    for (const b of works) byCreator.set(b.author, (byCreator.get(b.author) || 0) + 1);
    let topAuthor = "—", topAuthorN = 0;
    for (const [a, n] of byCreator) if (n > topAuthorN) { topAuthor = a; topAuthorN = n; }

    const notesByBook = new Map<string, number>();
    for (const n of notes) notesByBook.set(n.bookId, (notesByBook.get(n.bookId) || 0) + 1);
    let topBook = "—", topBookN = 0;
    for (const b of works) {
      const c = notesByBook.get(b.id) || 0;
      if (c > topBookN) { topBook = b.title; topBookN = c; }
    }
    return { topAuthor, topAuthorN, topBook, topBookN, authors: byCreator.size };
  }, [works, notes]);
  const creatorWord = media === "games" ? "developer" : media === "books" ? "author" : "creator";
  const workWord = media === "games" ? "game" : media === "books" ? "book" : "work";

  // Detail for the inspector card (top-right) for the hovered node.
  const hoverDetail = useMemo<InspectorDetail | null>(() => {
    if (!hoverId) return null;
    if (hoverId.startsWith("author:") || hoverId.startsWith("developer:")) {
      const dev = hoverId.startsWith("developer:");
      const name = hoverId.slice(hoverId.indexOf(":") + 1);
      const list = works.filter((b) => b.author === name && (b.mediaType === "game") === dev);
      const unit = dev ? "game" : "book";
      return {
        type: dev ? "developer" : "author",
        title: name,
        meta: `${list.length} ${unit}${list.length === 1 ? "" : "s"}`,
        rows: list.map((b) => ({ label: b.title, value: statusLabel(b.status, b.mediaType) })),
      };
    }
    if (hoverId.startsWith("book:")) {
      const bookId = hoverId.slice("book:".length);
      const b = books.find((x) => x.id === bookId);
      if (!b) return null;
      const noteCount = notes.filter((n) => n.bookId === bookId).length;
      const quoteCount = (Array.isArray(b.quotes) ? b.quotes : []).length;
      const game = b.mediaType === "game";
      return {
        type: game ? "game" : "book",
        title: b.title,
        meta: b.author,
        rows: [
          { label: "Status", value: statusLabel(b.status, b.mediaType) },
          game
            ? { label: "Played", value: formatHours(playMinutes(b)) }
            : { label: "Progress", value: `${b.pagesRead ?? 0} / ${b.totalPages ?? 0} hlm` },
          { label: "Notes", value: String(noteCount) },
          { label: "Quotes", value: String(quoteCount) },
        ],
        bookId,
      };
    }
    if (hoverId.startsWith("note:")) {
      const noteId = hoverId.slice("note:".length);
      const n = notes.find((x) => x.id === noteId);
      if (!n) return null;
      return {
        type: "note",
        title: n.bookTitle || "Note",
        meta: n.isSpoiler ? "Spoiler — open the note to read it." : n.text,
        rows: n.pageRef != null ? [{ label: "Halaman", value: String(n.pageRef) }] : [],
      };
    }
    if (hoverId.startsWith("quote:")) {
      const rest = hoverId.slice("quote:".length);
      const sep = rest.lastIndexOf(":");
      const bookId = sep > 0 ? rest.slice(0, sep) : rest;
      const idx = sep > 0 ? Number(rest.slice(sep + 1)) : NaN;
      const b = books.find((x) => x.id === bookId);
      const q = b ? normalizeQuote((Array.isArray(b.quotes) ? b.quotes : [])[idx]) : null;
      if (!q || !q.text) return null;
      return {
        type: "quote",
        title: b?.title || "Quote",
        meta: q.text,
        rows: q.page != null ? [{ label: "Halaman", value: String(q.page) }] : [],
      };
    }
    return null;
  }, [hoverId, books, works, notes]);

  const nodes = nodesRef.current;
  const links = linksRef.current;
  const highlight = hoverId ? neighbors.get(hoverId) : null;
  const isDim = (id: string) => hoverId != null && id !== hoverId && !(highlight?.has(id));

  const mediaSwitch = (
    <div className="irm-mediaswitch" role="tablist">
      {(["all", "books", "games"] as Media[]).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={media === m}
          className={`irm-mediaswitch__btn${media === m ? " is-active" : ""}`}
          onClick={() => setMedia(m)}
        >
          {m === "all" ? "All" : m === "books" ? "Books" : "Games"}
        </button>
      ))}
    </div>
  );

  if (isLoading || !notesLoaded) {
    return <div className="irm-loading"><div className="irm-spinner" /></div>;
  }

  return (
    <div className="irm-graph-page" style={{ height: `calc(100vh - ${headerH}px)` }}>
      <div className="irm-page-head">
        <div>
          <h1 className="irm-page-title">Reading map</h1>
          <p className="irm-page-sub">
            {viewMode === "semantic"
              ? "Your notes placed by meaning — nearby notes say similar things, across books and games."
              : "A network of interconnected authors, books, notes, and quotes."}
          </p>
        </div>
        <div className="irm-mediaswitch" role="tablist" style={{ marginTop: 0 }}>
          {(["network", "semantic"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={viewMode === v}
              className={`irm-mediaswitch__btn${viewMode === v ? " is-active" : ""}`}
              onClick={() => setParam("view", v === "network" ? null : v)}
            >
              {v === "network" ? "Network" : "Semantic"}
            </button>
          ))}
        </div>
      </div>
      {viewMode === "semantic" && <SemanticMap media={media} controls={mediaSwitch} />}
      {/* Kept mounted while hidden so its zoom/resize listeners survive mode switches. */}
      <div
        className="irm-graph__canvas"
        style={viewMode === "semantic" ? { display: "none" } : undefined}
        ref={wrapRef}
        onPointerDown={onBgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onMouseLeave={() => setHoverId(null)}
      >
          {nodes.length === 0 ? (
            <div className="irm-empty" style={{ height: "100%" }}>
              <div className="irm-empty__text">Nothing to map yet — add books and notes first.</div>
            </div>
          ) : (
            <svg width={size.w} height={size.h} className="irm-graph__svg">
              <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
                {links.map((l, i) => {
                  const s = l.source as GNode;
                  const t = l.target as GNode;
                  if (s.x == null || t.x == null) return null;
                  const dim = isDim(s.id) && isDim(t.id);
                  return (
                    <line
                      key={i}
                      x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                      className="irm-graph__link"
                      style={{ opacity: dim ? 0.05 : 0.25 }}
                    />
                  );
                })}
                {nodes.map((n) => {
                  if (n.x == null) return null;
                  const dim = isDim(n.id);
                  const showLabel = n.type === "author" || n.type === "book" || n.type === "developer" || n.type === "game" || hoverId === n.id;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      style={{ opacity: dim ? 0.2 : 1, cursor: n.bookId ? "pointer" : "grab" }}
                      onPointerDown={(e) => onNodePointerDown(e, n)}
                      onMouseEnter={() => setHoverId(n.id)}
                    >
                      <circle
                        r={n.r}
                        fill={TYPE_META[n.type].color}
                        stroke="var(--bg-elev)"
                        strokeWidth={1.5}
                      />
                      {showLabel && (
                        <text
                          className="irm-graph__label"
                          x={0}
                          y={n.r + 11}
                          textAnchor="middle"
                        >
                          {n.label.length > 24 ? n.label.slice(0, 24) + "…" : n.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* Books/Games switch + legend filters */}
          <div className="irm-graph__controls">
          {mediaSwitch}
          <div className="irm-graph__legend">
            {shownTypes.map((t) => (
              <button
                key={t}
                className={`irm-graph__legend-item${visible[t] ? "" : " is-off"}`}
                onClick={() => setVisible((v) => ({ ...v, [t]: !v[t] }))}
              >
                <span className="irm-graph__swatch" style={{ background: TYPE_META[t].color }} />
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          </div>

          {/* Stats */}
          <div className="irm-graph__stats">
            <button
              type="button"
              className="irm-graph__stats-head"
              onClick={() => setStatsOpen((o) => !o)}
              aria-expanded={statsOpen}
            >
              <span>Stats</span>
              <span className={`irm-graph__stats-chev${statsOpen ? " is-open" : ""}`}>
                <Icon.ChevronDown size={14} />
              </span>
            </button>
            {statsOpen && (
              <div className="irm-graph__stats-body">
                <div className="irm-graph__stat">
                  <span className="irm-graph__stat-label">Most featured {creatorWord}</span>
                  <span className="irm-graph__stat-val">{stats.topAuthor}</span>
                  <span className="irm-graph__stat-sub irm-mono">{stats.topAuthorN} {workWord}s</span>
                </div>
                <div className="irm-graph__stat">
                  <span className="irm-graph__stat-label">Most noted {workWord}</span>
                  <span className="irm-graph__stat-val">{stats.topBook}</span>
                  <span className="irm-graph__stat-sub irm-mono">{stats.topBookN} notes</span>
                </div>
              </div>
            )}
          </div>

          {/* Inspector (top-right) for hovered node */}
          {hoverDetail && (
            <div className="irm-graph__inspector">
              <div className="irm-graph__inspector-head">
                <span className="irm-graph__swatch" style={{ background: TYPE_META[hoverDetail.type].color }} />
                <span className="irm-graph__inspector-title">{hoverDetail.title}</span>
                <span className="irm-graph__inspector-type irm-mono">{TYPE_META[hoverDetail.type].label}</span>
              </div>
              {hoverDetail.meta && <p className="irm-graph__inspector-meta">{hoverDetail.meta}</p>}
              {hoverDetail.rows && hoverDetail.rows.length > 0 && (
                <div className="irm-graph__inspector-rows">
                  {hoverDetail.rows.map((r, i) => (
                    <div key={i} className="irm-graph__inspector-row">
                      <span className="irm-graph__inspector-row-label">{r.label}</span>
                      <span className="irm-graph__inspector-row-val irm-mono">{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {hoverDetail.bookId && (
                <button
                  type="button"
                  className="irm-btn irm-btn--ghost irm-graph__inspector-open"
                  onClick={() => navigate(`/book/${hoverDetail.bookId}`)}
                >
                  Buka buku <Icon.ChevronRight size={14} />
                </button>
              )}
            </div>
          )}

          {/* Interaction hint */}
          <div className="irm-graph__hint irm-mono">drag · scroll to zoom · click a book to open</div>
        </div>
    </div>
  );
}
