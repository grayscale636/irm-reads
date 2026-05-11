// Seed dummy data for visualization testing.
// Usage: node scripts/seed.js [user_email]
// Default user_email: test@test.test

require('dotenv').config();
const { Pool } = require('pg');

const TODAY = new Date('2026-05-11'); // matches the in-app "today"
const TARGET_EMAIL = process.argv[2] || 'test@test.test';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
});

const MS = 86400000;
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function isoDate(date) { return date.toISOString().slice(0, 10); }
function daysAgo(n) { return isoDate(addDays(TODAY, -n)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// === Books ===
// completed books, ordered by finishedAt
const completedBooks = [
  { title: 'Atomic Habits', author: 'James Clear', totalPages: 320, rating: 5, startedAt: daysAgo(260), finishedAt: daysAgo(245) },
  { title: 'Deep Work', author: 'Cal Newport', totalPages: 304, rating: 5, startedAt: daysAgo(230), finishedAt: daysAgo(210) },
  { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', totalPages: 499, rating: 4, startedAt: daysAgo(205), finishedAt: daysAgo(155) },
  { title: 'So Good They Can\'t Ignore You', author: 'Cal Newport', totalPages: 288, rating: 4, startedAt: daysAgo(150), finishedAt: daysAgo(135) },
  { title: 'Sapiens', author: 'Yuval Noah Harari', totalPages: 464, rating: 5, startedAt: daysAgo(130), finishedAt: daysAgo(120) }, // fast finish
  { title: 'The Pragmatic Programmer', author: 'David Thomas', totalPages: 352, rating: 5, startedAt: daysAgo(115), finishedAt: daysAgo(95) },
  { title: 'Homo Deus', author: 'Yuval Noah Harari', totalPages: 450, rating: 4, startedAt: daysAgo(90), finishedAt: daysAgo(70) },
  { title: 'Clean Code', author: 'Robert C. Martin', totalPages: 464, rating: 4, startedAt: daysAgo(80), finishedAt: daysAgo(60) },
  { title: 'The Lean Startup', author: 'Eric Ries', totalPages: 336, rating: 4, startedAt: daysAgo(55), finishedAt: daysAgo(38) },
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', totalPages: 616, rating: 5, startedAt: daysAgo(45), finishedAt: daysAgo(22) },
];

const readingBooks = [
  { title: 'The Almanack of Naval Ravikant', author: 'Eric Jorgenson', totalPages: 244, rating: 0, startedAt: daysAgo(12), pagesRead: 168, lastLogDaysAgo: 0 }, // fresh
  { title: 'A Philosophy of Software Design', author: 'John Ousterhout', totalPages: 190, rating: 0, startedAt: daysAgo(30), pagesRead: 112, lastLogDaysAgo: 7 }, // cooling
  { title: 'Domain-Driven Design', author: 'Eric Evans', totalPages: 560, rating: 0, startedAt: daysAgo(70), pagesRead: 134, lastLogDaysAgo: 28 }, // stalled
  { title: 'Idiot Brain', author: 'Dean Burnett', totalPages: 384, rating: 0, startedAt: daysAgo(180), pagesRead: 86, lastLogDaysAgo: 142 }, // frozen
];

const wantToRead = [
  { title: 'The Mom Test', author: 'Rob Fitzpatrick', totalPages: 130 },
  { title: 'Shape Up', author: 'Ryan Singer', totalPages: 152 },
  { title: 'Why We Sleep', author: 'Matthew Walker', totalPages: 360 },
  { title: 'Range', author: 'David Epstein', totalPages: 352 },
];

// Generate realistic logs for a completed book: pages spread across the reading window,
// not every single day (most readers have gaps).
function generateCompletedLogs(book, bookId) {
  const startMs = new Date(book.startedAt).getTime();
  const endMs = new Date(book.finishedAt).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / MS));
  // Read on ~60-80% of days
  const readingDays = Math.max(2, Math.round(days * (0.6 + Math.random() * 0.2)));
  // Pick distinct dates
  const dateSet = new Set();
  // Always include startedAt and finishedAt
  dateSet.add(book.startedAt);
  dateSet.add(book.finishedAt);
  while (dateSet.size < readingDays) {
    const dayOffset = rand(0, days);
    dateSet.add(isoDate(addDays(book.startedAt, dayOffset)));
  }
  const dates = Array.from(dateSet).sort();
  const logs = [];
  let cursor = 0;
  for (let i = 0; i < dates.length; i++) {
    const remaining = book.totalPages - cursor;
    const remainingDates = dates.length - i;
    // Distribute remaining pages with some variance
    const baseChunk = remaining / remainingDates;
    const chunk = i === dates.length - 1
      ? remaining
      : Math.max(1, Math.round(baseChunk * (0.6 + Math.random() * 0.8)));
    const startPage = cursor;
    const endPage = Math.min(book.totalPages, cursor + chunk);
    cursor = endPage;
    logs.push({
      id: uid('log'),
      bookId,
      date: dates[i],
      pagesRead: endPage - startPage,
      startPage,
      endPage,
    });
    if (cursor >= book.totalPages) break;
  }
  return logs;
}

// For currently-reading books: logs from startedAt to lastLogDaysAgo, total pages = pagesRead.
function generateReadingLogs(book, bookId) {
  const startedAt = book.startedAt;
  const lastLogDate = daysAgo(book.lastLogDaysAgo);
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(lastLogDate).getTime();
  const days = Math.max(1, Math.round((endMs - startMs) / MS));
  const readingDays = Math.max(2, Math.min(days + 1, Math.round((days + 1) * (0.5 + Math.random() * 0.3))));
  const dateSet = new Set([startedAt, lastLogDate]);
  while (dateSet.size < readingDays) {
    const dayOffset = rand(0, days);
    dateSet.add(isoDate(addDays(startedAt, dayOffset)));
  }
  const dates = Array.from(dateSet).sort();
  const logs = [];
  let cursor = 0;
  for (let i = 0; i < dates.length; i++) {
    const remaining = book.pagesRead - cursor;
    const remainingDates = dates.length - i;
    const baseChunk = remaining / remainingDates;
    const chunk = i === dates.length - 1
      ? remaining
      : Math.max(1, Math.round(baseChunk * (0.6 + Math.random() * 0.8)));
    const startPage = cursor;
    const endPage = Math.min(book.pagesRead, cursor + chunk);
    cursor = endPage;
    logs.push({
      id: uid('log'),
      bookId,
      date: dates[i],
      pagesRead: endPage - startPage,
      startPage,
      endPage,
    });
    if (cursor >= book.pagesRead) break;
  }
  return logs;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id, email FROM users WHERE email = $1', [TARGET_EMAIL]);
    if (rows.length === 0) {
      console.error(`No user with email ${TARGET_EMAIL}. Register first or pass a different email.`);
      process.exit(1);
    }
    const userId = rows[0].id;
    console.log(`Seeding for user ${TARGET_EMAIL} (${userId})`);

    await client.query('BEGIN');

    // Wipe existing books and logs for this user so re-running gives clean state
    await client.query('DELETE FROM reading_logs WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM books WHERE user_id = $1', [userId]);

    const allLogs = [];

    // Insert completed books
    for (const b of completedBooks) {
      const id = uid('book');
      await client.query(
        `INSERT INTO books (id, user_id, title, author, cover, rating, progress, status,
                            pages_read, total_pages, started_at, finished_at, quotes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, userId, b.title, b.author, null, b.rating, 100, 'completed',
         b.totalPages, b.totalPages, b.startedAt, b.finishedAt, []]
      );
      allLogs.push(...generateCompletedLogs(b, id));
    }

    // Insert currently reading books
    for (const b of readingBooks) {
      const id = uid('book');
      const progress = Math.round((b.pagesRead / b.totalPages) * 100);
      await client.query(
        `INSERT INTO books (id, user_id, title, author, cover, rating, progress, status,
                            pages_read, total_pages, started_at, finished_at, quotes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, userId, b.title, b.author, null, b.rating, progress, 'reading',
         b.pagesRead, b.totalPages, b.startedAt, null, []]
      );
      allLogs.push(...generateReadingLogs(b, id));
    }

    // Insert want-to-read books
    for (const b of wantToRead) {
      const id = uid('book');
      await client.query(
        `INSERT INTO books (id, user_id, title, author, cover, rating, progress, status,
                            pages_read, total_pages, quotes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, userId, b.title, b.author, null, 0, 0, 'want-to-read', 0, b.totalPages, []]
      );
    }

    // Insert all reading logs
    for (const log of allLogs) {
      await client.query(
        `INSERT INTO reading_logs (id, user_id, book_id, date, pages_read, start_page, end_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [log.id, userId, log.bookId, log.date, log.pagesRead, log.startPage, log.endPage]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${completedBooks.length} completed + ${readingBooks.length} reading + ${wantToRead.length} want-to-read books, ${allLogs.length} reading logs.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
