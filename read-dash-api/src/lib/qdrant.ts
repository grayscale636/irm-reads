import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = 'book_pages';

// OpenRouter embedding config
const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_MODEL = 'text-embedding-3-small';
const OR_URL = 'https://openrouter.ai/api/v1/embeddings';
const DIM = 1536; // text-embedding-3-small

let client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!client) client = new QdrantClient({ url: QDRANT_URL });
  return client;
}

/**
 * Embed text(s) via OpenRouter API (text-embedding-3-small).
 * Batches up to 20 texts per API call.
 */
async function embed(
  texts: string | string[],
  batchSize: number = 20
): Promise<number[][]> {
  const input = Array.isArray(texts) ? texts : [texts];
  const results: number[][] = [];

  for (let i = 0; i < input.length; i += batchSize) {
    const batch = input.slice(i, i + batchSize).map(t => t.slice(0, 4000));

    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OR_MODEL,
        input: batch,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter embedding error (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      results.push(item.embedding);
    }
  }

  return results;
}

// ── Keyword extraction (text fallback) ──

function extractKeywords(query: string): string[] {
  const stopwords = new Set([
    'apa','siapa','yang','dari','dan','ini','itu','di','ke','dengan',
    'pada','saya','gw','gue','aku','kamu','lu','lo','nggak','tidak',
    'bisa','tolong','coba','udah','sudah','loh','kah','nya','punya',
    'mana','tentang','secara','sejauh','ada','untuk','saja','sih',
    'doang','lagi','juga','akan','oleh','atau','kalo','kalau','dah',
    'udh','udah','emang','memang','banget','bgt','gimana','bagaimana',
    'gitu','begitu','gini','begini','dulu','sekarang','sudah','telah',
    'berapa','banyak','semua','seluruh','setiap','masing','masing2',
  ]);
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
  return [...new Set(words)];
}

async function textSearch(
  qdrant: QdrantClient,
  bookId: string,
  maxPage: number,
  keywords: string[],
  limit: number = 5
): Promise<{ page: number; text: string; score: number }[]> {
  const results = await qdrant.scroll(COLLECTION, {
    filter: {
      must: [
        { key: 'book_id', match: { value: bookId } },
        { key: 'page', range: { lte: maxPage } },
      ],
    },
    limit: 2000,
    with_payload: true,
    with_vector: false,
  });
  if (!results.points?.length) return [];

  const scored = [];
  for (const pt of results.points) {
    const text = (pt.payload?.text as string || '').toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > 0) {
      scored.push({
        page: pt.payload?.page as number || 0,
        text: pt.payload?.text as string || '',
        score: score / keywords.length,
      });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── Public API ──

/**
 * Search Qdrant for relevant chunks using OpenRouter embeddings
 * (text-embedding-3-small, 1536-dim), with text fallback for entity queries.
 */
export async function searchRelevantChunks(
  bookId: string,
  maxPage: number,
  query: string,
  limit: number = 5
): Promise<{ page: number; text: string; score: number }[]> {
  try {
    const qdrant = getClient();
    const collections = await qdrant.getCollections();
    if (!collections.collections.some(c => c.name === COLLECTION)) return [];

    // 1. Semantic search via OpenRouter
    const vectors = await embed(query);
    const searchResult = await qdrant.search(COLLECTION, {
      vector: vectors[0],
      limit,
      with_payload: true,
      filter: {
        must: [
          { key: 'book_id', match: { value: bookId } },
          { key: 'page', range: { lte: maxPage } },
        ],
      },
    });

    const semanticHits = searchResult.map(r => ({
      page: r.payload?.page as number || 0,
      text: r.payload?.text as string || '',
      score: r.score || 0,
    }));

    // 2. Text fallback jika semantic search skor rendah
    if (semanticHits.length > 0 && semanticHits[0].score >= 0.65) {
      return semanticHits.slice(0, limit);
    }

    const keywords = extractKeywords(query);
    if (keywords.length > 0) {
      const textHits = await textSearch(qdrant, bookId, maxPage, keywords, limit);
      if (textHits.length > 0) {
        const seenPages = new Set(textHits.map(h => h.page));
        const combined = [...textHits];
        for (const sh of semanticHits) {
          if (!seenPages.has(sh.page) && combined.length < limit * 2) {
            combined.push(sh);
          }
        }
        return combined.slice(0, limit);
      }
    }

    return semanticHits;
  } catch (error) {
    console.error('Qdrant search error:', error);
    return [];
  }
}

/**
 * Fallback: scroll last pages for general recap queries.
 */
export async function getPagesContext(
  bookId: string,
  maxPage: number,
  maxChars: number = 6000
): Promise<string[]> {
  try {
    const qdrant = getClient();
    const collections = await qdrant.getCollections();
    if (!collections.collections.some(c => c.name === COLLECTION)) return [];

    const results = await qdrant.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'book_id', match: { value: bookId } },
          { key: 'page', range: { lte: maxPage } },
        ],
      },
      limit: 1000,
      with_payload: true,
      with_vector: false,
    });
    if (!results.points?.length) return [];

    const sorted = results.points.sort((a, b) => {
      const pA = a.payload?.page as number || 0;
      const pB = b.payload?.page as number || 0;
      if (pA !== pB) return pA - pB;
      return (a.payload?.chunk_index as number || 0) - (b.payload?.chunk_index as number || 0);
    });

    const out: string[] = [];
    let chars = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const text = sorted[i].payload?.text as string || '';
      const page = sorted[i].payload?.page as number;
      if (chars + text.length > maxChars) {
        const rem = maxChars - chars;
        if (rem > 200) out.push(`[Halaman ${page}]\n${text.slice(0, rem)}`);
        break;
      }
      out.push(`[Halaman ${page}]\n${text}`);
      chars += text.length;
    }
    return out.reverse();
  } catch (error) {
    console.error('Qdrant scroll error:', error);
    return [];
  }
}

/**
 * Get all unique characters across chunks up to maxPage.
 * Uses the pre-extracted 'characters' payload field.
 */
export async function getAllCharacters(
  bookId: string,
  maxPage: number
): Promise<{ name: string; frequency: number; firstAppearance: number }[]> {
  try {
    const qdrant = getClient();
    const collections = await qdrant.getCollections();
    if (!collections.collections.some(c => c.name === COLLECTION)) return [];

    const results = await qdrant.scroll(COLLECTION, {
      filter: {
        must: [
          { key: 'book_id', match: { value: bookId } },
          { key: 'page', range: { lte: maxPage } },
        ],
      },
      limit: 2000,
      with_payload: true,
      with_vector: false,
    });

    if (!results.points?.length) return [];

    const charMap = new Map<string, { count: number; firstPage: number }>();
    for (const pt of results.points) {
      const chars = (pt.payload?.characters as string[]) || [];
      const page = pt.payload?.page as number || 0;
      for (const name of chars) {
        const existing = charMap.get(name);
        if (existing) {
          existing.count++;
        } else {
          charMap.set(name, { count: 1, firstPage: page });
        }
      }
    }

    // Apply frequency filtering to reduce noise
    // Multi-word names: ≥2 occurrences, Single-word: ≥3 occurrences
    const allNames = [...charMap.entries()];
    const filtered = allNames.filter(([name, info]) => {
      const wordCount = name.split(/\s+/).length;
      return wordCount >= 2 ? info.count >= 2 : info.count >= 3;
    });

    // Remove single-word names that are substrings of longer names
    const filteredNames = new Set(filtered.map(([n]) => n));
    const deduped = filtered.filter(([name]) => {
      if (name.split(/\s+/).length === 1) {
        return ![...filteredNames].some(other => other !== name && other.includes(name));
      }
      return true;
    });

    return deduped
      .map(([name, info]) => ({
        name,
        frequency: info.count,
        firstAppearance: info.firstPage,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  } catch (error) {
    console.error('Qdrant getAllCharacters error:', error);
    return [];
  }
}

/** Embed many texts in batch (for ingestion scripts). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  return embed(texts);
}

/** Get the Qdrant collection name and dimension. */
export function getCollectionConfig(): { name: string; dim: number } {
  return { name: COLLECTION, dim: DIM };
}
