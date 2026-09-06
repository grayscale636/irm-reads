import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8222';
// Whole-book OCR of a scanned PDF can take several minutes on CPU, so keep the
// internal call to the OCR service generous. The client never waits on this —
// jobs run in the background and are polled via GET /jobs/:jobId.
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 30 * 60 * 1000);
const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB

const TMP_DIR = path.join(os.tmpdir(), 'irmreads-ocr');
fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES },
});

// ---------------------------------------------------------------------------
// In-memory job registry (single-instance PM2 app). Lost on restart, which is
// acceptable for a fire-and-forget import.
// ---------------------------------------------------------------------------
interface OcrJob {
  jobId: string;
  bookId: string;
  userId: string;
  status: 'processing' | 'done' | 'error';
  pageCount: number;
  processedPages: number;
  notesCreated: number;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, OcrJob>();

function publicJob(job: OcrJob) {
  const { userId: _u, ...rest } = job;
  return rest;
}

function isPdf(name: string): boolean {
  return path.extname(name).toLowerCase() === '.pdf';
}

// ---------------------------------------------------------------------------
// Background worker
// ---------------------------------------------------------------------------
async function runOcrJob(job: OcrJob, filePath: string, originalName: string): Promise<void> {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    // 1. Send to the OCR microservice (localhost, no reverse-proxy timeout).
    const form = new FormData();
    form.append('file', new Blob([fileBuffer], { type: 'application/octet-stream' }), originalName);
    form.append('job_id', job.jobId);

    // Poll OCR-service progress in parallel with the long request.
    const poller = setInterval(() => {
      fetch(`${OCR_SERVICE_URL}/progress/${job.jobId}`)
        .then((r) => r.json() as Promise<{ status?: string; total?: number; page?: number }>)
        .then((p) => {
          if (p && p.status === 'processing' && typeof p.total === 'number') {
            job.pageCount = p.total;
            job.processedPages = p.page ?? job.processedPages;
          }
        })
        .catch(() => {});
    }, 1500);

    let resp: Awaited<ReturnType<typeof fetch>>;
    try {
      resp = await fetch(`${OCR_SERVICE_URL}/ocr`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
      });
    } finally {
      clearInterval(poller);
    }

    if (!resp.ok) {
      let detail = `OCR service returned ${resp.status}`;
      try {
        const body = (await resp.json()) as { detail?: unknown };
        if (body?.detail) detail = String(body.detail);
      } catch { /* ignore */ }
      throw new Error(detail);
    }

    const data = (await resp.json()) as {
      pageCount?: number;
      pages?: { page: number; text: string }[];
    };

    const pages = Array.isArray(data.pages) ? data.pages : [];
    job.pageCount = pages.length;
    job.processedPages = 0;

    // 2. Create one note per page that has recognized text.
    const nonEmpty = pages.filter((p) => p.text && p.text.trim().length > 0);
    for (const p of nonEmpty) {
      await pool.query(
        `INSERT INTO book_notes (book_id, user_id, text, note_type, page_ref, tags)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [job.bookId, job.userId, p.text.trim(), 'note', p.page, ['ocr', 'imported']]
      );
      job.processedPages += 1;
      job.notesCreated += 1;
    }

    job.status = 'done';
  } catch (e) {
    job.status = 'error';
    job.error = e instanceof Error ? e.message : String(e);
    console.error(`[ocr] job ${job.jobId} failed:`, job.error);
  } finally {
    // Clean up temp file.
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Upload a book file (PDF/image) and auto-import OCR'd pages as notes.
router.post('/books/:bookId', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const userId = req.userId as string;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use multipart field "file".' });
      return;
    }

    // Verify book ownership.
    const book = await pool.query('SELECT id FROM books WHERE id = $1 AND user_id = $2', [bookId, userId]);
    if (book.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const jobId = crypto.randomUUID();
    const job: OcrJob = {
      jobId,
      bookId,
      userId,
      status: 'processing',
      pageCount: 0,
      processedPages: 0,
      notesCreated: 0,
      createdAt: Date.now(),
    };
    jobs.set(jobId, job);

    // Fire and forget.
    runOcrJob(job, req.file.path, req.file.originalname);

    res.status(202).json({ jobId, status: 'processing' });
  } catch (error) {
    console.error('[ocr] upload error:', error);
    res.status(500).json({ error: 'Failed to start OCR job' });
  }
});

// Poll job status.
router.get('/jobs/:jobId', async (req: AuthRequest, res: Response) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (job.userId !== req.userId) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(publicJob(job));
});

export default router;
