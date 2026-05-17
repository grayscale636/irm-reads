import { Router, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Get all notes for book
router.get('/book/:bookId', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const result = await pool.query(`
      SELECT id, book_id as "bookId", text, created_at::text as "createdAt"
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
    const { bookId, text } = req.body;
    if (!bookId || !text?.trim()) {
      res.status(400).json({ error: 'bookId and text are required' });
      return;
    }
    const result = await pool.query(`
      INSERT INTO book_notes (book_id, user_id, text)
      VALUES ($1, $2, $3)
      RETURNING id, book_id as "bookId", text, created_at::text as "createdAt"
    `, [bookId, req.userId, text.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update note
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const result = await pool.query(
      'UPDATE book_notes SET text = $1 WHERE id = $2 AND user_id = $3 RETURNING id, book_id as "bookId", text, created_at::text as "createdAt"',
      [text.trim(), id, req.userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json(result.rows[0]);
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
