-- Migration 009: Generalize books → media (books + games), flexible progress
-- units, session-log metadata, and richer notes (spoiler flag, free-form ref,
-- image attachments). Fully backward compatible: existing rows default to
-- media_type='book', progress_unit='page'.

-- ---------------------------------------------------------------------------
-- books: media_type + progress_unit + game metadata (JSONB)
-- ---------------------------------------------------------------------------
ALTER TABLE books ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) NOT NULL DEFAULT 'book';
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_media_type_check;
ALTER TABLE books ADD CONSTRAINT books_media_type_check
  CHECK (media_type IN ('book', 'game'));

ALTER TABLE books ADD COLUMN IF NOT EXISTS progress_unit VARCHAR(20) NOT NULL DEFAULT 'page';
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_progress_unit_check;
ALTER TABLE books ADD CONSTRAINT books_progress_unit_check
  CHECK (progress_unit IN ('page', 'hour', 'chapter', 'percent'));

-- Game-specific metadata (platform, difficulty, etc.). Stored as JSONB so the
-- book schema stays untouched; NULL for books.
ALTER TABLE books ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- reading_logs: session-log metadata (duration + checkpoint note)
--   start_page/end_page/pages_read remain the generic "value in progress_unit"
--   for backward compatibility; for books they are pages, for games they can
--   be hours/chapters/percent depending on the book's progress_unit.
-- ---------------------------------------------------------------------------
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS checkpoint TEXT;

-- ---------------------------------------------------------------------------
-- book_notes: free-form ref, spoiler flag, image attachments
-- ---------------------------------------------------------------------------
ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS ref TEXT;
ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_book_notes_spoiler ON book_notes(is_spoiler);
CREATE INDEX IF NOT EXISTS idx_books_media_type ON books(media_type);
