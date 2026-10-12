-- Migration 010: Steam integration. Per-user SteamID; imported games keep
-- steam_appid + last seen playtime (minutes) in books.metadata so a periodic
-- sync can turn playtime deltas into session logs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_id VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_books_steam_appid ON books ((metadata->>'steam_appid'))
  WHERE metadata ? 'steam_appid';
