-- Migration 005: Create goals table (yearly reading goals).
-- The /api/goals endpoint references this table; it was created out-of-band
-- on the current production DB but had no migration file. This makes a
-- fresh deploy work without manual SQL.

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  target INTEGER NOT NULL DEFAULT 0 CHECK (target >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, year)
);
