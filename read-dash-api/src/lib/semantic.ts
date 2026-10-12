import { UMAP } from 'umap-js';
import { pool } from '../db';

// Semantic layer: local multilingual sentence embeddings (no external API, the
// notes never leave the server) stored in Qdrant, plus a 2D map + nearest
// neighbours for the graph. Chosen over multilingual-e5-small after comparing
// both on real notes: much wider gap between related and unrelated notes.
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DIM = 384;
const QDRANT = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = 'irmreads_notes';
/** Very short notes ("shodanco anj") are noise in a meaning map. */
export const MIN_CHARS = 40;
const NEIGHBOURS = 3;
/** Below this, similarity is close to chance (measured against hand-labelled themes). */
export const MIN_SCORE = 0.45;
/** Theme suggestions: up to 8 nearest labelled notes vote, but only neighbours scoring
 *  ≥ MIN_SCORE count (otherwise unrelated text still gets a confident-looking vote). A theme
 *  needs ≥50% of the vote from ≥2 different works (else a book just echoes its own labels).
 *  Leave-one-out on 121 labelled notes: 77% precision, suggests for ~1/3; wrongly suggests
 *  something for 15% of notes judged to have no theme. */
const SUGGEST_K = 8;
const SUGGEST_MIN_CONF = 0.5;
const SUGGEST_MIN_WORKS = 2;

// transformers.js is ESM-only; keep a real dynamic import under CommonJS.
const dynImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
let embedderPromise: Promise<any> | null = null;

function embedder(): Promise<any> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await dynImport('@huggingface/transformers');
      env.cacheDir = `${process.cwd()}/.cache/transformers`;
      return pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    })().catch((e) => {
      embedderPromise = null;
      throw e;
    });
  }
  return embedderPromise;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await embedder();
  const out = await model(texts, { pooling: 'mean', normalize: true });
  return out.tolist();
}

async function qdrant(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${QDRANT}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Qdrant ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 404 ? null : res.json();
}

let collectionReady: Promise<void> | null = null;
export function ensureCollection(): Promise<void> {
  if (!collectionReady) {
    collectionReady = (async () => {
      const existing = await qdrant(`/collections/${COLLECTION}`);
      if (!existing) {
        await qdrant(`/collections/${COLLECTION}`, {
          method: 'PUT',
          body: JSON.stringify({ vectors: { size: DIM, distance: 'Cosine' } }),
        });
        await qdrant(`/collections/${COLLECTION}/index`, {
          method: 'PUT',
          body: JSON.stringify({ field_name: 'user_id', field_schema: 'keyword' }),
        });
      }
    })().catch((e) => {
      collectionReady = null;
      throw e;
    });
  }
  return collectionReady;
}

// The map for a user is cached until one of their notes is (re)indexed.
const mapCache = new Map<string, SemanticMap>();

/** (Re)embed one note, or drop it from the index if it's gone or too short. */
export async function indexNote(noteId: string): Promise<void> {
  await ensureCollection();
  const { rows } = await pool.query(
    `SELECT n.id, n.user_id, n.book_id, n.text, b.media_type
     FROM book_notes n JOIN books b ON b.id = n.book_id WHERE n.id = $1`,
    [noteId]
  );
  const note = rows[0];
  if (!note || note.text.trim().length < MIN_CHARS) {
    await removeNote(noteId, note?.user_id);
    return;
  }
  const [vector] = await embed([note.text.trim()]);
  await qdrant(`/collections/${COLLECTION}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({
      points: [{ id: note.id, vector, payload: { user_id: note.user_id, book_id: note.book_id, media_type: note.media_type } }],
    }),
  });
  mapCache.delete(note.user_id);
}

export async function removeNote(noteId: string, userId?: string): Promise<void> {
  await ensureCollection();
  await qdrant(`/collections/${COLLECTION}/points/delete?wait=true`, {
    method: 'POST',
    body: JSON.stringify({ points: [noteId] }),
  });
  if (userId) mapCache.delete(userId);
  else mapCache.clear();
}

/** Embed every eligible note (all users, or one). Batched; returns how many were indexed. */
export async function reindex(userId?: string): Promise<number> {
  await ensureCollection();
  const { rows } = await pool.query(
    `SELECT n.id, n.user_id, n.book_id, n.text, b.media_type
     FROM book_notes n JOIN books b ON b.id = n.book_id
     WHERE ($1::uuid IS NULL OR n.user_id = $1::uuid)`,
    [userId ?? null]
  );
  const eligible = rows.filter((r) => r.text.trim().length >= MIN_CHARS);
  const tooShort = rows.filter((r) => r.text.trim().length < MIN_CHARS).map((r) => r.id);
  if (tooShort.length) {
    await qdrant(`/collections/${COLLECTION}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({ points: tooShort }),
    });
  }
  for (let i = 0; i < eligible.length; i += 32) {
    const batch = eligible.slice(i, i + 32);
    const vectors = await embed(batch.map((r) => r.text.trim()));
    await qdrant(`/collections/${COLLECTION}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: batch.map((r, j) => ({
          id: r.id, vector: vectors[j], payload: { user_id: r.user_id, book_id: r.book_id, media_type: r.media_type },
        })),
      }),
    });
  }
  if (userId) mapCache.delete(userId);
  else mapCache.clear();
  return eligible.length;
}

export async function indexedCount(): Promise<number> {
  await ensureCollection();
  const r = await qdrant(`/collections/${COLLECTION}/points/count`, { method: 'POST', body: JSON.stringify({ exact: true }) });
  return r?.result?.count ?? 0;
}

async function userVectors(userId: string): Promise<Array<{ id: string; vector: number[] }>> {
  await ensureCollection();
  const points: Array<{ id: string; vector: number[] }> = [];
  let offset: unknown = null;
  do {
    const r = await qdrant(`/collections/${COLLECTION}/points/scroll`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { must: [{ key: 'user_id', match: { value: userId } }] },
        with_vector: true, with_payload: false, limit: 256, offset,
      }),
    });
    for (const p of r?.result?.points ?? []) points.push({ id: String(p.id), vector: p.vector });
    offset = r?.result?.next_page_offset ?? null;
  } while (offset);
  return points;
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

// Deterministic PRNG so the layout doesn't jump around between loads.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MapPoint {
  id: string; x: number; y: number;
  bookId: string; bookTitle: string; mediaType: 'book' | 'game';
  text: string; isSpoiler: boolean; noteType: string; themes: string[];
}
export interface SemanticMap {
  points: MapPoint[];
  edges: Array<{ source: string; target: string; score: number }>;
}

/** 2D UMAP layout + k nearest neighbours (computed in full dimension, not 2D). */
export async function semanticMap(userId: string): Promise<SemanticMap> {
  const cached = mapCache.get(userId);
  if (cached) return cached;

  const vecs = await userVectors(userId);
  const ids = vecs.map((v) => v.id);
  const { rows } = await pool.query(
    `SELECT n.id, n.book_id AS "bookId", n.text, n.is_spoiler AS "isSpoiler", n.note_type AS "noteType",
            b.title AS "bookTitle", b.media_type AS "mediaType",
            ARRAY(SELECT t.theme_slug FROM note_themes t WHERE t.note_id = n.id ORDER BY t.theme_slug) AS themes
     FROM book_notes n JOIN books b ON b.id = n.book_id
     WHERE n.user_id = $1 AND n.id = ANY($2::uuid[])`,
    [userId, ids]
  );
  const meta = new Map(rows.map((r) => [r.id, r]));
  const live = vecs.filter((v) => meta.has(v.id));
  // Notes deleted via their book (cascade) leave orphan points behind; prune them.
  const orphans = vecs.filter((v) => !meta.has(v.id)).map((v) => v.id);
  if (orphans.length) {
    await qdrant(`/collections/${COLLECTION}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({ points: orphans }),
    });
  }
  if (live.length < 3) return { points: [], edges: [] };

  const edges: SemanticMap['edges'] = [];
  const seen = new Set<string>();
  live.forEach((a, i) => {
    const scored = live
      .map((b, j) => ({ j, s: i === j ? -Infinity : dot(a.vector, b.vector) }))
      .sort((x, y) => y.s - x.s)
      .slice(0, NEIGHBOURS);
    for (const { j, s } of scored) {
      if (s < MIN_SCORE) continue;
      const key = [a.id, live[j].id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: a.id, target: live[j].id, score: Math.round(s * 1000) / 1000 });
    }
  });

  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(10, live.length - 1),
    minDist: 0.15,
    random: mulberry32(42),
  });
  const coords = umap.fit(live.map((v) => v.vector));
  // Normalise to [0, 1] so the client can scale freely.
  const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const points: MapPoint[] = live.map((v, i) => {
    const m = meta.get(v.id)!;
    return {
      id: v.id,
      x: (coords[i][0] - minX) / (maxX - minX || 1),
      y: (coords[i][1] - minY) / (maxY - minY || 1),
      bookId: m.bookId, bookTitle: m.bookTitle, mediaType: m.mediaType,
      text: m.text, isSpoiler: m.isSpoiler, noteType: m.noteType, themes: m.themes,
    };
  });
  const result = { points, edges };
  mapCache.set(userId, result);
  return result;
}

/** Most similar notes from *other* works — the cross-media connections. */
export async function relatedNotes(userId: string, noteId: string, limit = 5) {
  await ensureCollection();
  const own = await pool.query('SELECT book_id FROM book_notes WHERE id = $1 AND user_id = $2', [noteId, userId]);
  if (!own.rowCount) return [];
  const r = await qdrant(`/collections/${COLLECTION}/points/query`, {
    method: 'POST',
    body: JSON.stringify({
      query: noteId,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
        must_not: [{ key: 'book_id', match: { value: own.rows[0].book_id } }],
      },
      limit,
      score_threshold: MIN_SCORE,
      with_payload: false,
    }),
  });
  const hits: Array<{ id: string; score: number }> = (r?.result?.points ?? []).map((p: any) => ({ id: String(p.id), score: p.score }));
  if (!hits.length) return [];
  const { rows } = await pool.query(
    `SELECT n.id, n.book_id AS "bookId", n.text, n.is_spoiler AS "isSpoiler", n.ref,
            b.title AS "bookTitle", b.media_type AS "mediaType"
     FROM book_notes n JOIN books b ON b.id = n.book_id
     WHERE n.user_id = $1 AND n.id = ANY($2::uuid[])`,
    [userId, hits.map((h) => h.id)]
  );
  const byId = new Map(rows.map((x) => [x.id, x]));
  return hits.filter((h) => byId.has(h.id)).map((h) => ({ ...byId.get(h.id), score: Math.round(h.score * 1000) / 1000 }));
}

export interface ThemeSuggestion { slug: string; confidence: number }

/** Suggest themes for a vector (a stored note, or text being written) by letting the
 *  nearest *labelled* notes vote, weighted by similarity. */
async function suggestFor(userId: string, query: string | number[], excludeId?: string): Promise<ThemeSuggestion[]> {
  await ensureCollection();
  const r = await qdrant(`/collections/${COLLECTION}/points/query`, {
    method: 'POST',
    body: JSON.stringify({
      query,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
        ...(excludeId ? { must_not: [{ has_id: [excludeId] }] } : {}),
      },
      limit: 60,
      with_payload: false,
    }),
  });
  const hits: Array<{ id: string; score: number }> = (r?.result?.points ?? []).map((p: any) => ({ id: String(p.id), score: p.score }));
  if (!hits.length) return [];
  const { rows } = await pool.query(
    `SELECT t.note_id::text AS id, n.book_id AS "bookId", array_agg(t.theme_slug) AS themes
     FROM note_themes t JOIN book_notes n ON n.id = t.note_id
     WHERE t.note_id = ANY($1::uuid[]) GROUP BY t.note_id, n.book_id`,
    [hits.map((h) => h.id)]
  );
  const labelOf = new Map<string, { bookId: string; themes: string[] }>(rows.map((x) => [x.id, x]));
  const labelled = hits.filter((h) => h.score >= MIN_SCORE && labelOf.has(h.id)).slice(0, SUGGEST_K);
  const votes = new Map<string, number>();
  const works = new Map<string, Set<string>>();
  let total = 0;
  for (const h of labelled) {
    const w = Math.max(h.score, 0);
    const { bookId, themes } = labelOf.get(h.id)!;
    total += w;
    for (const t of themes) {
      votes.set(t, (votes.get(t) || 0) + w);
      (works.get(t) || works.set(t, new Set()).get(t)!).add(bookId);
    }
  }
  if (!total) return [];
  return [...votes.entries()]
    .map(([slug, v]) => ({ slug, confidence: Math.round((v / total) * 100) / 100 }))
    .filter((s) => s.confidence >= SUGGEST_MIN_CONF && (works.get(s.slug)?.size ?? 0) >= SUGGEST_MIN_WORKS)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);
}

export const suggestThemesForNote = (userId: string, noteId: string) => suggestFor(userId, noteId, noteId);

export async function suggestThemesForText(userId: string, text: string): Promise<ThemeSuggestion[]> {
  if (text.trim().length < MIN_CHARS) return [];
  const [vector] = await embed([text.trim()]);
  return suggestFor(userId, vector);
}

/** Notes with no theme yet, each with suggestions (the review queue). */
export async function unthemedNotes(userId: string) {
  const { rows } = await pool.query(
    `SELECT n.id, n.book_id AS "bookId", n.text, n.is_spoiler AS "isSpoiler", n.ref,
            b.title AS "bookTitle", b.media_type AS "mediaType"
     FROM book_notes n JOIN books b ON b.id = n.book_id
     WHERE n.user_id = $1 AND NOT n.themes_reviewed
       AND NOT EXISTS (SELECT 1 FROM note_themes t WHERE t.note_id = n.id)
     ORDER BY b.title, n.created_at`,
    [userId]
  );
  const out = [];
  for (const r of rows) {
    const suggestions = r.text.trim().length >= MIN_CHARS ? await suggestThemesForNote(userId, r.id).catch(() => []) : [];
    out.push({ ...r, suggestions });
  }
  return out;
}
