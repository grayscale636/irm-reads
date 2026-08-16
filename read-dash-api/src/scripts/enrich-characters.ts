/**
 * Update existing Qdrant points with extracted character names.
 *
 * Scans all chunks for the book, extracts names, updates payload.
 * Run this ONCE — it won't re-embed anything.
 *
 * Usage: BOOK_ID=<id> npx ts-node src/scripts/enrich-characters.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { extractCharacterNames, mergeCharacterNames } from '../lib/characters';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = 'book_pages';
const BOOK_ID = process.env.BOOK_ID || process.argv[2] || '';

async function main() {
  if (!BOOK_ID) {
    console.error('Missing BOOK_ID. Set env BOOK_ID=<id> or pass it as the 1st argument.');
    process.exit(1);
  }
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  // 1. Scroll all points for this book — WITH vectors so we can re-upsert
  const results = await qdrant.scroll(COLLECTION, {
    filter: { must: [{ key: 'book_id', match: { value: BOOK_ID } }] },
    limit: 2000,
    with_payload: true,
    with_vector: true,
  });

  const points = results.points;
  if (!points?.length) {
    console.log('No points found for book', BOOK_ID);
    return;
  }

  console.log(`📖 ${points.length} points to process`);

  // 2. Extract names from each chunk + prepare upsert batch
  const upsertPoints: any[] = [];
  let totalNames = 0;

  for (const pt of points) {
    const text = pt.payload?.text as string || '';
    if (!text) continue;

    const names = extractCharacterNames(text);
    upsertPoints.push({
      id: pt.id,
      vector: pt.vector,
      payload: {
        ...pt.payload,
        characters: names,
      },
    });
    totalNames += names.length;
  }

  console.log(`🔍 ${totalNames} total name occurrences across chunks`);

  // 3. Build master character list for display
  const allNames = upsertPoints.flatMap(p => p.payload.characters || []);
  const freq = new Map<string, number>();
  for (const n of allNames) freq.set(n, (freq.get(n) || 0) + 1);

  const perChunkNames = upsertPoints.map(p => p.payload.characters || []);
  const masterMap = mergeCharacterNames(perChunkNames);
  console.log(`👥 ${masterMap.size} unique character names:`);
  for (const [name, count] of masterMap) {
    console.log(`   ${name} (${count}x)`);
  }

  // 4. Update Qdrant payloads in batches (re-upsert with same vectors)
  console.log('\n💾 Updating Qdrant payloads...');
  for (let i = 0; i < upsertPoints.length; i += 100) {
    const batch = upsertPoints.slice(i, i + 100);
    await qdrant.upsert(COLLECTION, {
      points: batch.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
    if ((i + 100) % 500 === 0 || i + 100 >= upsertPoints.length) {
      console.log(`   Updated ${Math.min(i + 100, upsertPoints.length)}/${upsertPoints.length}`);
    }
  }

  // 5. Create payload index for characters
  try {
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'characters',
      field_schema: 'keyword',
    });
    console.log('   ✅ Created payload index for "characters"');
  } catch (e: any) {
    if (!e.message?.includes('already exists')) {
      console.warn('   ⚠️  Index creation:', e.message);
    }
  }

  console.log('\n✅ DONE! Characters enriched in Qdrant');
}

main().catch(console.error);
