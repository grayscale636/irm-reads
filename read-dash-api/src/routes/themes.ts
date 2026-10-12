import { Router, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/themes — the vocabulary, with how many of the user's notes/works touch each.
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT th.slug, th.name, th.description,
             COUNT(n.id)::int AS "noteCount",
             COUNT(DISTINCT n.book_id)::int AS "workCount"
      FROM themes th
      LEFT JOIN note_themes nt ON nt.theme_slug = th.slug
      LEFT JOIN book_notes n ON n.id = nt.note_id AND n.user_id = $1
      GROUP BY th.slug
      ORDER BY th.sort_order
    `, [req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// GET /api/themes/:slug — notes in a theme with their work, for Theme → work → note.
router.get('/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT n.id, n.book_id AS "bookId", n.text, n.note_type AS "noteType", n.ref,
             n.page_ref AS "pageRef", n.is_spoiler AS "isSpoiler", n.images, n.tags,
             ARRAY(SELECT t.theme_slug FROM note_themes t WHERE t.note_id = n.id ORDER BY t.theme_slug) AS themes,
             n.created_at::text AS "createdAt",
             b.title AS "bookTitle", b.author AS "bookAuthor", b.cover AS "bookCover",
             b.media_type AS "mediaType", b.status AS "bookStatus"
      FROM note_themes nt
      JOIN book_notes n ON n.id = nt.note_id
      JOIN books b ON b.id = n.book_id
      WHERE nt.theme_slug = $1 AND n.user_id = $2
      ORDER BY b.title, n.created_at
    `, [req.params.slug, req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching theme notes:', error);
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

export default router;
