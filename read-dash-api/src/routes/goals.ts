import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/goals/:year - Get user's goal for a year
router.get('/:year', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.params;
    const result = await pool.query(
      'SELECT target FROM goals WHERE user_id = $1 AND year = $2',
      [req.userId, parseInt(year)]
    );
    if (result.rows.length === 0) {
      res.json({ target: null });
      return;
    }
    res.json({ target: result.rows[0].target });
  } catch (err) {
    console.error('Error fetching goal:', err);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

// PUT /api/goals/:year - Set or clear user's goal for a year
router.put('/:year', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.params;
    const { target } = req.body; // null to clear, number to set

    if (target === null || target === undefined || target <= 0) {
      // Delete goal
      await pool.query(
        'DELETE FROM goals WHERE user_id = $1 AND year = $2',
        [req.userId, parseInt(year)]
      );
      res.json({ target: null });
      return;
    }

    const result = await pool.query(
      `INSERT INTO goals (user_id, year, target, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, year)
       DO UPDATE SET target = $3, updated_at = NOW()
       RETURNING target`,
      [req.userId, parseInt(year), target]
    );

    res.json({ target: result.rows[0].target });
  } catch (err) {
    console.error('Error setting goal:', err);
    res.status(500).json({ error: 'Failed to set goal' });
  }
});

export default router;
