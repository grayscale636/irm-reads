/**
 * Re-ingest a book PDF into Qdrant using OpenRouter embeddings.
 *
 * Usage: BOOK_ID=<id> npx ts-node src/scripts/reingest-pdf.ts <path-to-pdf>
 *
 * Deletes old collection, creates new one with 1536-dim vectors, ingests all.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import { QdrantClient } from '@qdrant/js-client-rest';
import { embedBatch, getCollectionConfig } from '../lib/qdrant';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const BOOK_ID = process.env.BOOK_ID || process.argv[3] || '';
const PDF_PATH = process.argv[2];

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: {
    book_id: string;
    page: number;
    text: string;
    chunk_index: number;
  };
}

async function main() {
  if (!PDF_PATH || !fs.existsSync(PDF_PATH)) {
    console.error('Usage: BOOK_ID=<id> npx ts-node src/scripts/reingest-pdf.ts <path-to-pdf>');
    process.exit(1);
  }
  if (!BOOK_ID) {
    console.error('Missing BOOK_ID. Set env BOOK_ID=<id> or pass it as the 2nd argument.');
    process.exit(1);
  }

  const { name: COLLECTION, dim } = getCollectionConfig();
  console.log(`Target: ${COLLECTION} (${dim} dim)`);

  // 1. Extract all pages
  const info = execSync(`pdfinfo "${PDF_PATH}"`, { encoding: 'utf-8' });
  const totalPages = parseInt(info.match(/Pages:\s+(\d+)/)?.[1] || '0');
  console.log(`📄 ${totalPages} pages`);

  const pages: string[] = [];
  for (let p = 1; p <= totalPages; p++) {
    const tmp = `/tmp/re_page_${p}.txt`;
    execSync(`pdftotext -f ${p} -l ${p} -layout "${PDF_PATH}" ${tmp}`, { encoding: 'utf-8', stdio: 'pipe' });
    const text = fs.readFileSync(tmp, 'utf-8').trim();
    pages.push(text || `[Page ${p}]`);
    fs.unlinkSync(tmp);
  }

  // 2. Chunk
  const chunks: { page: number; text: string }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const paragraphs = pages[i].split(/\n\n+/).filter(p => p.trim().length > 30);
    let cur = '';
    let n = 0;
    for (const para of paragraphs) {
      cur += (cur ? '\n\n' : '') + para.trim();
      n++;
      if (n >= 3 || cur.length > 2000) {
        chunks.push({ page: i + 1, text: cur });
        cur = '';
        n = 0;
      }
    }
    if (cur.trim().length > 0) chunks.push({ page: i + 1, text: cur });
  }
  console.log(`✂️  ${chunks.length} chunks`);

  // 3. Embed via OpenRouter
  console.log('🔢 Embedding via OpenRouter (text-embedding-3-small)...');
  const points: QdrantPoint[] = [];
  const batchSize = 20;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text.slice(0, 3000));
    const vectors = await embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      points.push({
        id: i + j,
        vector: vectors[j],
        payload: {
          book_id: BOOK_ID,
          page: batch[j].page,
          text: batch[j].text,
          chunk_index: i + j,
        },
      });
    }

    if ((i / batchSize) % 5 === 0) {
      console.log(`   ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
    }
  }
  console.log(`   ✅ ${points.length} vectors`);

  // 4. Delete & re-create Qdrant collection
  console.log('💾 Re-creating Qdrant collection...');
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  try {
    await qdrant.deleteCollection(COLLECTION);
    console.log('   Deleted old collection');
  } catch { /* might not exist */ }

  await qdrant.createCollection(COLLECTION, {
    vectors: { size: dim, distance: 'Cosine', on_disk: true },
  });
  console.log('   Created new collection');

  // 5. Upload in batches
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    await qdrant.upsert(COLLECTION, { points: batch });
    console.log(`   Uploaded ${Math.min(i + 100, points.length)}/${points.length}`);
  }

  await qdrant.createPayloadIndex(COLLECTION, {
    field_name: 'book_id',
    field_schema: 'keyword',
  });

  console.log(`\n✅ DONE! ${points.length} chunks re-ingested with text-embedding-3-small`);
  console.log(`   Collection: ${COLLECTION} (${dim} dim)`);
}

main().catch(console.error);
