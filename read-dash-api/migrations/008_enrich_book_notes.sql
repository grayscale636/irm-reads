-- Migration 008: Enrich book_notes for deeper personal journaling.
-- Notes were plain (text + created_at). This adds:
--   note_type  — 'note' | 'reflection' | 'question', so entries can be typed
--                and filtered in the Journal page.
--   page_ref   — the page the note is anchored to (nullable; free-form notes
--                may not tie to a page).
--   tags       — free tags for grouping ("theme", "character", "aha", …).

ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) NOT NULL DEFAULT 'note';
ALTER TABLE book_notes DROP CONSTRAINT IF EXISTS book_notes_type_check;
ALTER TABLE book_notes ADD CONSTRAINT book_notes_type_check
  CHECK (note_type IN ('note', 'reflection', 'question'));

ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS page_ref INTEGER;

ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_book_notes_type ON book_notes(note_type);
