import { Router, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { NoteType } from '../types';

const router = Router();
router.use(authMiddleware);

const VALID_TYPES: NoteType[] = ['note', 'reflection', 'question'];

// Coerce an incoming note_type to a known value, defaulting to 'note'.
function normalizeType(value: unknown): NoteType {
  return VALID_TYPES.includes(value as NoteType) ? (value as NoteType) : 'note';
}

// Normalize tags into a clean string array (trimmed, deduped, no empties).
function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    const t = String(raw).trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

// Coerce page_ref to a positive integer or null.
function normalizePageRef(value: unknown): number | null {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Coerce a free-form ref to a trimmed string or null.
function normalizeRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

// Normalize an images array into clean, deduped, non-empty URL strings.
function normalizeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    const u = String(raw).trim();
    if (u) seen.add(u);
  }
  return [...seen];
}

// Columns shared by every SELECT so the shape stays consistent.
const NOTE_COLS = `
  id, book_id as "bookId", text,
  note_type as "noteType", page_ref as "pageRef", ref,
  is_spoiler as "isSpoiler", images, tags,
  ARRAY(SELECT t.theme_slug FROM note_themes t WHERE t.note_id = book_notes.id ORDER BY t.theme_slug) AS themes,
  created_at::text as "createdAt"
`;

// Replace a note's themes. Unknown slugs are ignored (FK-safe via the themes join).
// `undefined` means "client didn't send themes" → leave them untouched.
async function setNoteThemes(noteId: string, themes: unknown): Promise<void> {
  if (!Array.isArray(themes)) return;
  const slugs = [...new Set(themes.map((t) => String(t).trim()).filter(Boolean))];
  await pool.query('DELETE FROM note_themes WHERE note_id = $1', [noteId]);
  if (slugs.length) {
    await pool.query(
      `INSERT INTO note_themes (note_id, theme_slug)
       SELECT $1, slug FROM themes WHERE slug = ANY($2::text[])`,
      [noteId, slugs]
    );
  }
}

async function fetchNote(id: string) {
  const r = await pool.query(`SELECT ${NOTE_COLS} FROM book_notes WHERE id = $1`, [id]);
  return r.rows[0];
}

// Get all notes for current user, joined with book info (for the Journal page)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT n.id, n.book_id as "bookId", n.text,
             n.note_type as "noteType", n.page_ref as "pageRef", n.ref,
             n.is_spoiler as "isSpoiler", n.images, n.tags,
             ARRAY(SELECT t.theme_slug FROM note_themes t WHERE t.note_id = n.id ORDER BY t.theme_slug) AS themes,
             n.created_at::text as "createdAt",
             b.title as "bookTitle", b.author as "bookAuthor"
      FROM book_notes n
      JOIN books b ON b.id = n.book_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `, [req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Get all notes for book
router.get('/book/:bookId', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const result = await pool.query(`
      SELECT ${NOTE_COLS}
      FROM book_notes
      WHERE book_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `, [bookId, req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Add note
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId, text, noteType, pageRef, ref, isSpoiler, images, tags, themes } = req.body;
    if (!bookId || (!text?.trim() && normalizeImages(images).length === 0)) {
      res.status(400).json({ error: 'bookId and text (or images) are required' });
      return;
    }
    const result = await pool.query(`
      INSERT INTO book_notes (book_id, user_id, text, note_type, page_ref, ref, is_spoiler, images, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${NOTE_COLS}
    `, [
      bookId, req.userId, (text ?? '').trim(),
      normalizeType(noteType), normalizePageRef(pageRef), normalizeRef(ref),
      Boolean(isSpoiler), normalizeImages(images), normalizeTags(tags),
    ]);
    await setNoteThemes(result.rows[0].id, themes);
    res.status(201).json(await fetchNote(result.rows[0].id));
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update note
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, noteType, pageRef, ref, isSpoiler, images, tags, themes } = req.body;
    if (!text?.trim() && normalizeImages(images).length === 0) {
      res.status(400).json({ error: 'text or images are required' });
      return;
    }
    const result = await pool.query(`
      UPDATE book_notes
      SET text = $1, note_type = $2, page_ref = $3, ref = $4, is_spoiler = $5, images = $6, tags = $7
      WHERE id = $8 AND user_id = $9
      RETURNING ${NOTE_COLS}
    `, [
      (text ?? '').trim(), normalizeType(noteType), normalizePageRef(pageRef), normalizeRef(ref),
      Boolean(isSpoiler), normalizeImages(images), normalizeTags(tags),
      id, req.userId,
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    await setNoteThemes(id, themes);
    res.json(await fetchNote(id));
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete note
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM book_notes WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
