import { Router, Response } from 'express';
import { pool } from '../db';
import { ReadingLog } from '../types';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all reading logs for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, book_id as "bookId", date::text, pages_read as "pagesRead",
             COALESCE(start_page, 0) as "startPage", COALESCE(end_page, pages_read) as "endPage"
      FROM reading_logs WHERE user_id = $1 ORDER BY date DESC, created_at DESC
    `, [req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reading logs:', error);
    res.status(500).json({ error: 'Failed to fetch reading logs' });
  }
});

// Get reading logs by book
router.get('/book/:bookId', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const result = await pool.query(`
      SELECT id, book_id as "bookId", date::text, pages_read as "pagesRead",
             COALESCE(start_page, 0) as "startPage", COALESCE(end_page, pages_read) as "endPage"
      FROM reading_logs WHERE book_id = $1 AND user_id = $2 ORDER BY date DESC, created_at DESC
    `, [bookId, req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reading logs:', error);
    res.status(500).json({ error: 'Failed to fetch reading logs' });
  }
});

// Create reading log
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const log: ReadingLog = req.body;
    
    // Verify the book belongs to the user
    const bookCheck = await pool.query('SELECT id FROM books WHERE id = $1 AND user_id = $2', [log.bookId, req.userId]);
    if (bookCheck.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    await pool.query(`
      INSERT INTO reading_logs (id, user_id, book_id, date, pages_read, start_page, end_page)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [log.id, req.userId, log.bookId, log.date, log.pagesRead, log.startPage, log.endPage]);

    // Update book's pages_read to the highest end_page for this book
    await pool.query(`
      UPDATE books
      SET pages_read = GREATEST(pages_read, $1),
          progress = LEAST(100, ROUND((GREATEST(pages_read, $1)::float / NULLIF(total_pages, 0)) * 100))
      WHERE id = $2 AND user_id = $3
    `, [log.endPage, log.bookId, req.userId]);

    res.status(201).json({ message: 'Reading log created', id: log.id });
  } catch (error) {
    console.error('Error creating reading log:', error);
    res.status(500).json({ error: 'Failed to create reading log' });
  }
});

// Delete reading log
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Get book_id before deleting so we can recalculate
    const logResult = await pool.query('SELECT book_id, end_page FROM reading_logs WHERE id = $1 AND user_id = $2', [id, req.userId]);
    const log = logResult.rows[0];

    const result = await pool.query('DELETE FROM reading_logs WHERE id = $1 AND user_id = $2', [id, req.userId]);

    // Recalculate book's pages_read from remaining logs
    if (log) {
      await pool.query(`
        UPDATE books
        SET pages_read = COALESCE((
          SELECT COALESCE(MAX(end_page), 0) FROM reading_logs WHERE book_id = $1 AND user_id = $2
        ), 0),
            progress = LEAST(100, ROUND((COALESCE((
              SELECT COALESCE(MAX(end_page), 0) FROM reading_logs WHERE book_id = $1 AND user_id = $2
            ), 0)::float / NULLIF(total_pages, 0)) * 100))
        WHERE id = $1 AND user_id = $2
      `, [log.book_id, req.userId]);
    }
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Reading log not found' });
      return;
    }
    res.json({ message: 'Reading log deleted', id });
  } catch (error) {
    console.error('Error deleting reading log:', error);
    res.status(500).json({ error: 'Failed to delete reading log' });
  }
});

export default router;
