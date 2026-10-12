import { pool } from '../db';

const API = 'https://api.steampowered.com';
const STORE = 'https://store.steampowered.com/api';
const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

// Steam exposes only playtime totals (no per-session history), so sessions are
// reconstructed from growth between syncs. Growth seen within SESSION_GAP_MS of
// the previous growth extends the same session instead of starting a new one.
export const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const SESSION_GAP_MS = SYNC_INTERVAL_MS + 15 * 60 * 1000;

export interface OwnedGame {
  appid: number;
  name: string;
  playtimeMinutes: number;
  lastPlayed: number | null; // unix seconds
  icon: string | null;
}

function apiKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error('STEAM_API_KEY is not configured');
  return key;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Steam request failed (${res.status})`);
  return res.json();
}

// Accepts a SteamID64, a /profiles/<id> URL, a /id/<vanity> URL, or a bare vanity name.
export async function resolveSteamId(input: string): Promise<string | null> {
  const raw = input.trim().replace(/\/+$/, '');
  const id64 = raw.match(/(?:^|\/profiles\/)(7656\d{13})$/);
  if (id64) return id64[1];
  const vanity = raw.match(/\/id\/([^/]+)$/)?.[1] ?? (/^[\w-]{2,32}$/.test(raw) ? raw : null);
  if (!vanity) return null;
  const data = await getJson(`${API}/ISteamUser/ResolveVanityURL/v1/?key=${apiKey()}&vanityurl=${encodeURIComponent(vanity)}`);
  return data?.response?.success === 1 ? data.response.steamid : null;
}

export async function getPlayerName(steamId: string): Promise<string | null> {
  const data = await getJson(`${API}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey()}&steamids=${steamId}`);
  return data?.response?.players?.[0]?.personaname ?? null;
}

// Empty list usually means "Game details" privacy isn't Public.
export async function getOwnedGames(steamId: string): Promise<OwnedGame[]> {
  const data = await getJson(
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${apiKey()}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`
  );
  const games: any[] = data?.response?.games ?? [];
  return games.map((g) => ({
    appid: g.appid,
    name: g.name,
    playtimeMinutes: g.playtime_forever ?? 0,
    lastPlayed: g.rtime_last_played || null,
    icon: g.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` : null,
  }));
}

// Portrait library capsule when it exists (older titles), else the store header image.
// Developer comes from the (unofficial) store API; both are best-effort.
export async function getStoreDetails(appid: number): Promise<{ cover: string | null; developer: string | null }> {
  let developer: string | null = null;
  let header: string | null = null;
  try {
    const data = await getJson(`${STORE}/appdetails?appids=${appid}`);
    const d = data?.[appid]?.data;
    developer = d?.developers?.[0] ?? d?.publishers?.[0] ?? null;
    header = d?.header_image ?? null;
  } catch { /* store API is flaky/rate-limited; fall through */ }

  const portrait = `${CDN}/${appid}/library_600x900.jpg`;
  try {
    const head = await fetch(portrait, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    if (head.ok) return { cover: portrait, developer };
  } catch { /* ignore */ }
  return { cover: header, developer };
}

// Turn playtime growth since the last snapshot into one session log per game.
// Rows are locked so a manual sync and the background timer can't double-log.
export async function syncUser(userId: string, steamId: string): Promise<{ updated: number; minutes: number }> {
  const owned = new Map((await getOwnedGames(steamId)).map((g) => [String(g.appid), g]));
  const client = await pool.connect();
  let updated = 0;
  let minutes = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, status, metadata FROM books
       WHERE user_id = $1 AND metadata ? 'steam_appid' FOR UPDATE`,
      [userId]
    );
    for (const book of rows) {
      const game = owned.get(String(book.metadata.steam_appid));
      if (!game) continue;
      const prev = Number(book.metadata.steam_playtime_minutes) || 0;
      const now = game.playtimeMinutes;
      const nowIso = new Date().toISOString();
      const meta: Record<string, unknown> = { ...book.metadata, steam_playtime_minutes: now, steam_last_synced: nowIso };
      if (now <= prev) {
        await client.query('UPDATE books SET metadata = $1 WHERE id = $2', [meta, book.id]);
        continue;
      }
      const delta = now - prev;
      const end = Math.floor(now / 60);
      const lastGrowth = Date.parse(String(book.metadata.steam_last_growth ?? ''));
      const openLog = book.metadata.steam_open_log as string | undefined;

      // Still the same sitting → extend the open session (if the user hasn't deleted it).
      let extended = false;
      if (openLog && Number.isFinite(lastGrowth) && Date.now() - lastGrowth <= SESSION_GAP_MS) {
        const r = await client.query(
          `UPDATE reading_logs SET end_page = $1, pages_read = $1 - start_page,
             duration_minutes = COALESCE(duration_minutes, 0) + $2
           WHERE id = $3 AND book_id = $4`,
          [end, delta, openLog, book.id]
        );
        extended = (r.rowCount ?? 0) > 0;
      }
      if (!extended) {
        const start = Math.floor(prev / 60);
        const logId = `steam-${book.metadata.steam_appid}-${Date.now()}`;
        await client.query(
          `INSERT INTO reading_logs (id, user_id, book_id, date, pages_read, start_page, end_page, duration_minutes)
           VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7)`,
          [logId, userId, book.id, end - start, start, end, delta]
        );
        meta.steam_open_log = logId;
      }
      meta.steam_last_growth = nowIso;
      await client.query(
        `UPDATE books SET metadata = $1, pages_read = $2,
           status = CASE WHEN status IN ('want-to-read', 'paused') THEN 'reading' ELSE status END,
           started_at = COALESCE(started_at, CURRENT_DATE),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [meta, end, book.id]
      );
      updated++;
      minutes += delta;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { updated, minutes };
}

export async function syncAllUsers(): Promise<void> {
  if (!process.env.STEAM_API_KEY) return;
  const { rows } = await pool.query('SELECT id, steam_id FROM users WHERE steam_id IS NOT NULL');
  for (const u of rows) {
    try {
      const r = await syncUser(u.id, u.steam_id);
      if (r.updated) console.log(`[steam] synced user ${u.id}: ${r.updated} game(s), +${r.minutes} min`);
    } catch (e) {
      console.error(`[steam] sync failed for user ${u.id}:`, e instanceof Error ? e.message : e);
    }
  }
}
