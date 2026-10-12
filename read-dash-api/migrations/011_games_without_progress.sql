-- Migration 011: games don't track progress toward a total (story length is
-- unknown and a percentage spoils pacing). Clear target/progress on games and
-- restore real hours played from the Steam playtime snapshot.
UPDATE books SET
  total_pages = 0,
  progress = 0,
  pages_read = CASE
    WHEN metadata ? 'steam_playtime_minutes' THEN FLOOR((metadata->>'steam_playtime_minutes')::numeric / 60)
    ELSE pages_read END
WHERE media_type = 'game';
