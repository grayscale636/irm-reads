import { Router, Response } from 'express';
import { pool } from '../db';
import { Book } from '../types';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all books for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, title, author, cover, rating, progress, status,
             pages_read as "pagesRead", total_pages as "totalPages",
             reflection, started_at::text as "startedAt",
             finished_at::text as "finishedAt", quotes
      FROM books WHERE user_id = $1 ORDER BY created_at DESC
    `, [req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get single book
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, title, author, cover, rating, progress, status,
             pages_read as "pagesRead", total_pages as "totalPages",
             reflection, started_at::text as "startedAt",
             finished_at::text as "finishedAt", quotes
      FROM books WHERE id = $1 AND user_id = $2
    `, [id, req.userId]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Create book
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const book: Book = req.body;
    console.log('Creating book:', { bookId: book.id, userId: req.userId, title: book.title });
    const result = await pool.query(`
      INSERT INTO books (id, user_id, title, author, cover, rating, progress, status,
                        pages_read, total_pages, reflection, started_at, finished_at, quotes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      book.id, req.userId, book.title, book.author, book.cover || null, book.rating || 0,
      book.progress || 0, book.status, book.pagesRead || 0, book.totalPages,
      book.reflection || null,
      book.startedAt || null, book.finishedAt || null,
      book.quotes || []
    ]);
    res.status(201).json({ message: 'Book created', id: result.rows[0].id });
  } catch (error: any) {
    console.error('Error creating book:', error.message, error.detail || '');
    res.status(500).json({ error: 'Failed to create book', detail: error.message });
  }
});

// Update book
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const book: Partial<Book> = req.body;
    
    // Verify ownership
    const ownerCheck = await pool.query('SELECT id FROM books WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (ownerCheck.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (book.title !== undefined) { fields.push(`title = $${paramCount++}`); values.push(book.title); }
    if (book.author !== undefined) { fields.push(`author = $${paramCount++}`); values.push(book.author); }
    if (book.cover !== undefined) { fields.push(`cover = $${paramCount++}`); values.push(book.cover); }
    if (book.rating !== undefined) { fields.push(`rating = $${paramCount++}`); values.push(book.rating); }
    if (book.progress !== undefined) { fields.push(`progress = $${paramCount++}`); values.push(book.progress); }
    if (book.status !== undefined) { fields.push(`status = $${paramCount++}`); values.push(book.status); }
    if (book.pagesRead !== undefined) { fields.push(`pages_read = $${paramCount++}`); values.push(book.pagesRead); }
    if (book.totalPages !== undefined) { fields.push(`total_pages = $${paramCount++}`); values.push(book.totalPages); }
    if (book.reflection !== undefined) { fields.push(`reflection = $${paramCount++}`); values.push(book.reflection); }
    if (book.startedAt !== undefined) { fields.push(`started_at = $${paramCount++}`); values.push(book.startedAt || null); }
    if (book.finishedAt !== undefined) { fields.push(`finished_at = $${paramCount++}`); values.push(book.finishedAt || null); }
    if (book.quotes !== undefined) { fields.push(`quotes = $${paramCount++}`); values.push(book.quotes); }
    
    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await pool.query(
      `UPDATE books SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    res.json({ message: 'Book updated', id });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete book
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM books WHERE id = $1 AND user_id = $2', [id, req.userId]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json({ message: 'Book deleted', id });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

export default router;
