-- Migration 003: Add book_notes table (multi-entry notes)
-- Replaces single-column notes with a proper 1-to-many table.

-- Remove the old notes column from books (data already migrated)
ALTER TABLE books DROP COLUMN IF EXISTS notes;

-- book_notes table is already created; keep it as is.
-- This migration serves as a record that notes column is removed.
