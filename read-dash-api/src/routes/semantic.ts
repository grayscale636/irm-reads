import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { reindex, relatedNotes, semanticMap } from '../lib/semantic';

const router = Router();
router.use(authMiddleware);

// GET /api/semantic/map — 2D meaning map of the user's notes + nearest-neighbour edges.
router.get('/map', async (req: AuthRequest, res: Response) => {
  try {
    res.json(await semanticMap(req.userId!));
  } catch (e) {
    console.error('[semantic] map failed:', e);
    res.status(502).json({ error: 'Semantic map unavailable' });
  }
});

// GET /api/semantic/related/:noteId — similar notes from other works.
router.get('/related/:noteId', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limit), 10) || 5));
    res.json(await relatedNotes(req.userId!, req.params.noteId, limit));
  } catch (e) {
    console.error('[semantic] related failed:', e);
    res.status(502).json({ error: 'Related notes unavailable' });
  }
});

// POST /api/semantic/reindex — rebuild this user's vectors.
router.post('/reindex', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ indexed: await reindex(req.userId!) });
  } catch (e) {
    console.error('[semantic] reindex failed:', e);
    res.status(502).json({ error: 'Reindex failed' });
  }
});

export default router;
