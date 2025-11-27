-- Migration: Add start_page and end_page columns to reading_logs
-- Run this migration after 001_add_users.sql

-- Add start_page column
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS start_page INTEGER DEFAULT 0;

-- Add end_page column  
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS end_page INTEGER DEFAULT 0;

-- Migrate existing data: set end_page = pages_read, start_page = 0
UPDATE reading_logs 
SET start_page = 0, end_page = pages_read 
WHERE end_page = 0 AND pages_read > 0;
