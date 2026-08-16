/**
 * Ingest a book PDF into Qdrant.
 * Uses pdftotext for extraction and @huggingface/transformers for embeddings.
 *
 * Usage: BOOK_ID=<id> npx ts-node src/scripts/ingest-pdf-qdrant.ts <path-to-pdf>
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = 'book_pages';
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

async function extractAllPages(pdfPath: string): Promise<string[]> {
  // Get total page count
  const info = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' });
  const match = info.match(/Pages:\s+(\d+)/);
  const totalPages = match ? parseInt(match[1]) : 0;
  console.log(`📄 PDF: ${totalPages} pages`);

  // Extract all pages with layout mode
  const tmpFile = '/tmp/cantik_full.txt';
  execSync(`pdftotext -layout "${pdfPath}" ${tmpFile}`, { encoding: 'utf-8' });
  const fullText = fs.readFileSync(tmpFile, 'utf-8');
  console.log(`   Total chars: ${fullText.length}`);

  // Extract pages individually for page-by-page text
  const pages: string[] = [];
  for (let p = 1; p <= totalPages; p++) {
    const pageTmp = `/tmp/cantik_page_${p}.txt`;
    try {
      // Use -f and -l for page range, -layout for column-aware layout
      execSync(`pdftotext -f ${p} -l ${p} -layout "${pdfPath}" ${pageTmp}`, { encoding: 'utf-8', stdio: 'pipe' });
      const pageText = fs.readFileSync(pageTmp, 'utf-8').trim();
      pages.push(pageText || `[Page ${p} - empty]`);
      fs.unlinkSync(pageTmp);
    } catch {
      pages.push(`[Page ${p} - extraction error]`);
    }
  }

  console.log(`   Extracted ${pages.length} pages`);
  return pages;
}

function chunkPages(pages: string[]): { page: number; text: string }[] {
  const chunks: { page: number; text: string }[] = [];

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i];

    // Split long pages by double newlines (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 30);

    let currentChunk = '';
    let paraCount = 0;

    for (const para of paragraphs) {
      currentChunk += (currentChunk ? '\n\n' : '') + para.trim();
      paraCount++;

      // Chunk every ~3 paragraphs or when chunk is large
      if (paraCount >= 3 || currentChunk.length > 2000) {
        chunks.push({ page: i + 1, text: currentChunk });
        currentChunk = '';
        paraCount = 0;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({ page: i + 1, text: currentChunk });
    }
  }

  console.log(`✂️  ${chunks.length} chunks from ${pages.length} pages`);
  return chunks;
}

async function main() {
  if (!PDF_PATH || !fs.existsSync(PDF_PATH)) {
    console.error('Usage: BOOK_ID=<id> npx ts-node src/scripts/ingest-pdf-qdrant.ts <path-to-pdf>');
    process.exit(1);
  }
  if (!BOOK_ID) {
    console.error('Missing BOOK_ID. Set env BOOK_ID=<id> or pass it as the 2nd argument.');
    process.exit(1);
  }

  // 1. Extract pages
  const pages = await extractAllPages(PDF_PATH);

  // 2. Chunk
  const chunks = chunkPages(pages);

  // 3. Generate embeddings
  console.log('🧠 Loading embedding model...');
  const { pipeline } = await import('@huggingface/transformers');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('   Model loaded');

  console.log('🔢 Generating embeddings...');
  const points: QdrantPoint[] = [];
  const batchSize = 20;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text.slice(0, 3000));

    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const embeddings: number[][] = output.tolist();

    for (let j = 0; j < batch.length; j++) {
      points.push({
        id: i + j,
        vector: embeddings[j],
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
  console.log(`   ✅ ${points.length} vectors generated`);

  // 4. Upload to Qdrant
  console.log('💾 Uploading to Qdrant...');
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION);

  if (!exists) {
    console.log('   Creating collection...');
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: 384, distance: 'Cosine', on_disk: true },
    });
  } else {
    // Clear old data for this book
    await qdrant.delete(COLLECTION, {
      filter: { must: [{ key: 'book_id', match: { value: BOOK_ID } }] },
    });
    console.log('   Cleared old data');
  }

  // Batch upload (100 per batch)
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    await qdrant.upsert(COLLECTION, { points: batch });
    console.log(`   Uploaded ${Math.min(i + 100, points.length)}/${points.length}`);
  }

  // Create index for book_id filter
  await qdrant.createPayloadIndex(COLLECTION, {
    field_name: 'book_id',
    field_schema: 'keyword',
  });

  console.log(`\n✅ DONE! ${points.length} chunks in Qdrant`);
  console.log(`   Book ID: ${BOOK_ID}`);
  console.log(`   Collection: ${COLLECTION}`);
}

main().catch(console.error);
