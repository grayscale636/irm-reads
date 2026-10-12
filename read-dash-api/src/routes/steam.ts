import { Router, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { normalizeBookStatus } from './books';
import { getOwnedGames, getPlayerName, getStoreDetails, resolveSteamId, syncUser } from '../lib/steam';

const router = Router();
router.use(authMiddleware);

async function linkedSteamId(userId?: string): Promise<string | null> {
  const r = await pool.query('SELECT steam_id FROM users WHERE id = $1', [userId]);
  return r.rows[0]?.steam_id ?? null;
}

function fail(res: Response, e: unknown, msg: string) {
  console.error(`[steam] ${msg}:`, e);
  res.status(502).json({ error: e instanceof Error ? e.message : msg });
}

// GET /api/steam/status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const steamId = await linkedSteamId(req.userId);
    res.json({
      configured: Boolean(process.env.STEAM_API_KEY),
      steamId,
      name: steamId ? await getPlayerName(steamId).catch(() => null) : null,
    });
  } catch (e) { fail(res, e, 'status failed'); }
});

// PUT /api/steam/link { profile } — SteamID64, profile URL, or vanity name. Empty unlinks.
router.put('/link', async (req: AuthRequest, res: Response) => {
  try {
    const input = String(req.body?.profile ?? '').trim();
    if (!input) {
      await pool.query('UPDATE users SET steam_id = NULL WHERE id = $1', [req.userId]);
      res.json({ steamId: null, name: null });
      return;
    }
    const steamId = await resolveSteamId(input);
    if (!steamId) {
      res.status(400).json({ error: 'Steam profile not found' });
      return;
    }
    await pool.query('UPDATE users SET steam_id = $1 WHERE id = $2', [steamId, req.userId]);
    res.json({ steamId, name: await getPlayerName(steamId).catch(() => null) });
  } catch (e) { fail(res, e, 'link failed'); }
});

// GET /api/steam/library — owned games, flagged when already on the shelf.
router.get('/library', async (req: AuthRequest, res: Response) => {
  try {
    const steamId = await linkedSteamId(req.userId);
    if (!steamId) {
      res.status(400).json({ error: 'Steam account not linked' });
      return;
    }
    const [games, shelf] = await Promise.all([
      getOwnedGames(steamId),
      pool.query(`SELECT id, metadata->>'steam_appid' AS appid FROM books WHERE user_id = $1 AND metadata ? 'steam_appid'`, [req.userId]),
    ]);
    const onShelf = new Map(shelf.rows.map((r) => [r.appid, r.id]));
    games.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
    res.json(games.map((g) => ({ ...g, bookId: onShelf.get(String(g.appid)) ?? null })));
  } catch (e) { fail(res, e, 'library failed'); }
});

// POST /api/steam/import { games: [{ appid, status }] }
// Current playtime becomes the baseline; only playtime after import is logged as sessions.
router.post('/import', async (req: AuthRequest, res: Response) => {
  try {
    const steamId = await linkedSteamId(req.userId);
    if (!steamId) {
      res.status(400).json({ error: 'Steam account not linked' });
      return;
    }
    const wanted: Array<{ appid: number; status?: string }> =
      Array.isArray(req.body?.games) ? req.body.games.slice(0, 50) : [];
    const owned = new Map((await getOwnedGames(steamId)).map((g) => [g.appid, g]));
    const statuses = new Set(['reading', 'paused', 'want-to-read', 'completed', 'dnf']);
    const created: string[] = [];

    for (const w of wanted) {
      const game = owned.get(Number(w.appid));
      if (!game) continue;
      const exists = await pool.query(
        `SELECT 1 FROM books WHERE user_id = $1 AND metadata->>'steam_appid' = $2`,
        [req.userId, String(game.appid)]
      );
      if (exists.rowCount) continue;

      const { cover, developer } = await getStoreDetails(game.appid);
      const played = Math.floor(game.playtimeMinutes / 60);
      const status = statuses.has(String(w.status)) ? String(w.status) : played > 0 ? 'paused' : 'want-to-read';
      const id = `steam-${game.appid}-${Date.now()}`;
      await pool.query(
        `INSERT INTO books (id, user_id, title, author, cover, rating, progress, status, pages_read, total_pages,
                            started_at, quotes, media_type, progress_unit, metadata)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, 0, $8, '{}', 'game', 'hour', $9)`,
        [
          id, req.userId, game.name, developer || 'Unknown', cover, status, played,
          status === 'reading' ? new Date().toISOString().slice(0, 10) : null,
          { platform: 'PC (Steam)', steam_appid: game.appid, steam_playtime_minutes: game.playtimeMinutes,
            steam_last_synced: new Date().toISOString() },
        ]
      );
      await normalizeBookStatus(id, req.userId);
      created.push(id);
    }
    res.status(201).json({ created });
  } catch (e) { fail(res, e, 'import failed'); }
});

// POST /api/steam/sync — pull playtime now instead of waiting for the timer.
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const steamId = await linkedSteamId(req.userId);
    if (!steamId) {
      res.status(400).json({ error: 'Steam account not linked' });
      return;
    }
    res.json(await syncUser(req.userId!, steamId));
  } catch (e) { fail(res, e, 'sync failed'); }
});

export default router;
