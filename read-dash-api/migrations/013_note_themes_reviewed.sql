-- Migration 013: let a note be reviewed as "no theme" so it leaves the
-- Unthemed queue (plot recaps, gameplay remarks, character lists).
ALTER TABLE book_notes ADD COLUMN IF NOT EXISTS themes_reviewed BOOLEAN NOT NULL DEFAULT false;
-- Notes that already have themes count as reviewed.
UPDATE book_notes n SET themes_reviewed = true
WHERE EXISTS (SELECT 1 FROM note_themes t WHERE t.note_id = n.id);
