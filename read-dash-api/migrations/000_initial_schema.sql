-- Initial schema: users, books, reading_logs
-- This is the consolidated schema (matches README) that you'd run on a fresh database.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  cover TEXT,
  rating INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'want-to-read',
  pages_read INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  reflection TEXT,
  started_at DATE,
  finished_at DATE,
  quotes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reading_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id VARCHAR(255) REFERENCES books(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pages_read INTEGER DEFAULT 0,
  start_page INTEGER DEFAULT 0,
  end_page INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_user_id ON reading_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_book_id ON reading_logs(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_date ON reading_logs(date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
