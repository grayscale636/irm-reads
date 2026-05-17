-- Migration 006: Expand books.status CHECK constraint to include
-- 'paused' and 'dnf'. The frontend already exposes these statuses; without
-- this the API returns 500 when a user tries to pause or DNF a book.

ALTER TABLE books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE books ADD CONSTRAINT books_status_check
  CHECK (status IN ('reading', 'completed', 'want-to-read', 'paused', 'dnf'));
