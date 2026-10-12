// One-off: seed approximate play sessions for imported Steam games from the only
// history Steam exposes (total playtime, last-2-weeks playtime, last played date).
// Also sets finished_at of completed games to the last played date (instead of
// the import day) and pulls started_at back to the first known play.
//
//   npx ts-node scripts/seed-steam-sessions.ts          # dry run (prints plan)
//   npx ts-node scripts/seed-steam-sessions.ts --apply  # write
//
// Idempotent: seed log ids are deterministic and games that already have logs are skipped.
import { pool } from '../src/db';
import { getOwnedGames } from '../src/lib/steam';

const APPLY = process.argv.includes('--apply');
const TZ = 'Asia/Jakarta';
const DAY = 86400;

const toDate = (unix: number) => new Date(unix * 1000).toLocaleDateString('en-CA', { timeZone: TZ });

async function main() {
  const users = await pool.query('SELECT id, steam_id FROM users WHERE steam_id IS NOT NULL');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of users.rows) {
      const owned = new Map(
        (await getOwnedGames(u.steam_id)).map((g) => [String(g.appid), g])
      );
      const recent2w = await recentTwoWeeks(u.steam_id);
      const { rows: games } = await client.query(
        `SELECT b.id, b.title, b.status, b.started_at::text AS started, b.finished_at::text AS finished,
                b.created_at::date::text AS imported, b.metadata
         FROM books b
         WHERE b.user_id = $1 AND b.metadata ? 'steam_appid'
           AND NOT EXISTS (SELECT 1 FROM reading_logs l WHERE l.book_id = b.id)
         ORDER BY b.title`,
        [u.id]
      );
      for (const b of games) {
        const appid = String(b.metadata.steam_appid);
        const game = owned.get(appid);
        const total = Number(b.metadata.steam_playtime_minutes) || 0; // baseline at import
        if (!game || total <= 0 || !game.lastPlayed) continue;

        const recent = Math.min(recent2w.get(appid) ?? 0, total);
        const earlier = total - recent;
        const last = toDate(game.lastPlayed);
        const earlierDate = recent > 0 ? toDate(game.lastPlayed - 14 * DAY) : last;
        const logs: Array<[string, string, number, number, number, string]> = [];
        let cursor = 0;
        if (earlier > 0) {
          logs.push([`steam-seed-${appid}-earlier`, earlierDate, 0, Math.floor(earlier / 60), earlier,
            'Steam: earlier playtime (approx.)']);
          cursor = earlier;
        }
        if (recent > 0) {
          logs.push([`steam-seed-${appid}-recent`, last, Math.floor(cursor / 60), Math.floor(total / 60), recent,
            'Steam: last 2 weeks (approx.)']);
        }

        // Steam doesn't know when you started; only pull an existing start date back
        // so it isn't later than the first known play. Unknown stays unknown.
        const newStarted = b.started && logs[0][1] < b.started ? logs[0][1] : null;
        const newFinished = b.status === 'completed' && b.finished === b.imported ? last : null;

        console.log(`\n${b.title} [${b.status}] total ${(total / 60).toFixed(1)}h`);
        for (const [, date, , , mins, note] of logs) console.log(`  + ${date}  ${String(mins).padStart(4)} min  ${note}`);
        if (newStarted) console.log(`  started_at: ${b.started ?? '—'} → ${newStarted}`);
        if (newFinished) console.log(`  finished_at: ${b.finished} → ${newFinished}`);

        for (const [id, date, start, end, mins, note] of logs) {
          await client.query(
            `INSERT INTO reading_logs (id, user_id, book_id, date, pages_read, start_page, end_page, duration_minutes, checkpoint)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
            [id, u.id, b.id, date, end - start, start, end, mins, note]
          );
        }
        if (newStarted || newFinished) {
          await client.query(
            `UPDATE books SET started_at = COALESCE($1::date, started_at), finished_at = COALESCE($2::date, finished_at)
             WHERE id = $3`,
            [newStarted, newFinished, b.id]
          );
        }
      }
    }
    await client.query(APPLY ? 'COMMIT' : 'ROLLBACK');
    console.log(APPLY ? '\nApplied.' : '\nDry run — nothing written. Re-run with --apply.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

// playtime_2weeks per appid (GetOwnedGames includes it only for recently played games).
async function recentTwoWeeks(steamId: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${process.env.STEAM_API_KEY}&steamid=${steamId}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const data: any = await res.json();
  return new Map((data?.response?.games ?? []).map((g: any) => [String(g.appid), g.playtime_2weeks ?? 0]));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
