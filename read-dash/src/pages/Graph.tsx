import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

type NodeType = "author" | "book" | "note" | "quote";

interface GNode extends SimulationNodeDatum {
  id: string;
  type: NodeType;
  label: string;
  r: number;
  bookId?: string;
  sub?: string;
}

type GLink = SimulationLinkDatum<GNode>;

const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  author: { label: "Author", color: "#6366f1" },
  book: { label: "Book", color: "#0ea5e9" },
  note: { label: "Note", color: "#f59e0b" },
  quote: { label: "Quote", color: "#a855f7" },
};

const ALL_TYPES: NodeType[] = ["author", "book", "note", "quote"];

export default function Graph() {
  const navigate = useNavigate();
  const { books, isLoading } = useBooks();
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [visible, setVisible] = useState<Record<NodeType, boolean>>({
    author: true, book: true, note: true, quote: true,
  });
  const [hoverId, setHoverId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const viewInit = useRef(false);

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

  // Measure the canvas area.
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
  }, []);

  // Build the graph model (nodes + links) from books, notes, quotes.
  const graph = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const authorBooks = new Map<string, number>();
    for (const b of books) authorBooks.set(b.author, (authorBooks.get(b.author) || 0) + 1);

    const notesByBook = new Map<string, number>();
    for (const n of notes) notesByBook.set(n.bookId, (notesByBook.get(n.bookId) || 0) + 1);

    // Author nodes — sized by how many of their books you own.
    if (visible.author) {
      for (const [author, count] of authorBooks) {
        nodes.push({
          id: `author:${author}`,
          type: "author",
          label: author,
          r: 7 + Math.sqrt(count) * 4,
          sub: `${count} book${count === 1 ? "" : "s"}`,
        });
      }
    }

    for (const b of books) {
      const noteCount = notesByBook.get(b.id) || 0;
      const quoteCount = (Array.isArray(b.quotes) ? b.quotes : []).length;
      const entries = noteCount + quoteCount;
      if (visible.book) {
        nodes.push({
          id: `book:${b.id}`,
          type: "book",
          label: b.title,
          r: 6 + Math.sqrt(entries) * 3,
          bookId: b.id,
          sub: `${noteCount} notes · ${quoteCount} quotes`,
        });
        if (visible.author) {
          links.push({ source: `author:${b.author}`, target: `book:${b.id}` });
        }
      }
    }

    if (visible.note) {
      for (const n of notes) {
        nodes.push({
          id: `note:${n.id}`,
          type: "note",
          label: n.text.slice(0, 40),
          r: 4,
          bookId: n.bookId,
          sub: n.bookTitle,
        });
        if (visible.book) links.push({ source: `book:${n.bookId}`, target: `note:${n.id}` });
      }
    }

    if (visible.quote) {
      for (const b of books) {
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
          if (visible.book) links.push({ source: `book:${b.id}`, target: `quote:${b.id}:${idx}` });
        });
      }
    }

    // Drop links whose endpoints were filtered out.
    const ids = new Set(nodes.map((n) => n.id));
    const validLinks = links.filter(
      (l) => ids.has(l.source as string) && ids.has(l.target as string),
    );
    return { nodes, links: validLinks };
  }, [books, notes, visible]);

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

  // (Re)build the simulation whenever the graph model changes. Node objects are
  // reused across rebuilds so positions carry over and the layout stays stable.
  useEffect(() => {
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
        .distance((l) => ((l.source as GNode).type === "author" ? 70 : 34))
        .strength(0.5))
      .force("charge", forceManyBody<GNode>().strength((d) => -18 - d.r * 4))
      .force("collide", forceCollide<GNode>((d) => d.r + 3))
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(0.03))
      .force("y", forceY(0).strength(0.03))
      .on("tick", () => forceRender((t) => t + 1));

    simRef.current = sim;
    return () => { sim.stop(); };
  }, [graph]);

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
        const k = Math.min(4, Math.max(0.2, v.k * factor));
        return {
          k,
          tx: mx - (mx - v.tx) * (k / v.k),
          ty: my - (my - v.ty) * (k / v.k),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const stats = useMemo(() => {
    const authorBooks = new Map<string, number>();
    for (const b of books) authorBooks.set(b.author, (authorBooks.get(b.author) || 0) + 1);
    let topAuthor = "—", topAuthorN = 0;
    for (const [a, n] of authorBooks) if (n > topAuthorN) { topAuthor = a; topAuthorN = n; }

    const notesByBook = new Map<string, number>();
    for (const n of notes) notesByBook.set(n.bookId, (notesByBook.get(n.bookId) || 0) + 1);
    let topBook = "—", topBookN = 0;
    for (const b of books) {
      const c = notesByBook.get(b.id) || 0;
      if (c > topBookN) { topBook = b.title; topBookN = c; }
    }
    return { topAuthor, topAuthorN, topBook, topBookN, authors: authorBooks.size };
  }, [books, notes]);

  const nodes = nodesRef.current;
  const links = linksRef.current;
  const highlight = hoverId ? neighbors.get(hoverId) : null;
  const isDim = (id: string) => hoverId != null && id !== hoverId && !(highlight?.has(id));

  if (isLoading || !notesLoaded) {
    return <div className="irm-loading"><div className="irm-spinner" /></div>;
  }

  return (
    <div className="irm-main">
      <div className="irm-page-head">
        <div>
          <p className="irm-eyebrow">Graph</p>
          <h1 className="irm-page-title">Your reading map</h1>
          <p className="irm-page-sub">
            Node size shows weight — bigger authors are read more, bigger books hold more notes.
            Drag to rearrange, scroll to zoom, click a book to open it.
          </p>
        </div>
      </div>

      <div className="irm-graph">
        <div
          className="irm-graph__canvas"
          ref={wrapRef}
          onPointerDown={onBgPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
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
                  const showLabel = n.type === "author" || n.type === "book" || hoverId === n.id;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      style={{ opacity: dim ? 0.2 : 1, cursor: n.bookId ? "pointer" : "grab" }}
                      onPointerDown={(e) => onNodePointerDown(e, n)}
                      onMouseEnter={() => setHoverId(n.id)}
                      onMouseLeave={() => setHoverId(null)}
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

          {/* Legend + filters */}
          <div className="irm-graph__legend">
            {ALL_TYPES.map((t) => (
              <button
                key={t}
                className={`irm-graph__legend-item${visible[t] ? "" : " is-off"}`}
                onClick={() => setVisible((v) => ({ ...v, [t]: !v[t] }))}
                title={`Toggle ${TYPE_META[t].label}`}
              >
                <span className="irm-graph__swatch" style={{ background: TYPE_META[t].color }} />
                {TYPE_META[t].label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="irm-graph__stats">
            <div className="irm-graph__stat">
              <span className="irm-graph__stat-label">Most read author</span>
              <span className="irm-graph__stat-val">{stats.topAuthor}</span>
              <span className="irm-graph__stat-sub irm-mono">{stats.topAuthorN} books</span>
            </div>
            <div className="irm-graph__stat">
              <span className="irm-graph__stat-label">Most noted book</span>
              <span className="irm-graph__stat-val">{stats.topBook}</span>
              <span className="irm-graph__stat-sub irm-mono">{stats.topBookN} notes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
