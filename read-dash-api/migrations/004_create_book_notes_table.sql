-- Migration 004: Create book_notes table.
-- Migration 003 dropped the legacy `books.notes` column but assumed this
-- table already existed (it was created out-of-band). This migration makes
-- the dependency explicit so a fresh deploy doesn't break.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS book_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id VARCHAR(255) NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_notes_book ON book_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_user ON book_notes(user_id);
