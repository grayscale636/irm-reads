-- Data cleanup DRY-RUN: read-only report of suspicious rows. Changes nothing.
-- Run: psql -d irmreads -f scripts/cleanup-report.sql

\echo '== 1. Duplicate titles =='
SELECT lower(title) AS title, count(*), string_agg(id || ' [' || status || ']', ', ') AS entries
FROM books GROUP BY lower(title) HAVING count(*) > 1;

\echo '== 2. Status vs progress/finished_at inconsistencies =='
SELECT id, title, status, progress, pages_read, total_pages, finished_at
FROM books
WHERE (status = 'completed' AND (progress < 100 OR finished_at IS NULL))
   OR (status IN ('reading','paused','want-to-read') AND finished_at IS NOT NULL);

\echo '== 3. Duplicate reading logs (book_id, date, start, end) =='
SELECT b.title, l.date, l.start_page, l.end_page, count(*) AS copies, string_agg(l.id, ', ') AS ids
FROM reading_logs l JOIN books b ON b.id = l.book_id
GROUP BY b.title, l.book_id, l.date, l.start_page, l.end_page HAVING count(*) > 1
ORDER BY copies DESC;

\echo '== 4. Seed/fixed log ids =='
SELECT b.title, count(*) AS logs, min(l.date) AS first, max(l.date) AS last
FROM reading_logs l JOIN books b ON b.id = l.book_id
WHERE l.id LIKE 'seed-%' OR l.id LIKE 'fixed-%'
GROUP BY b.title ORDER BY logs DESC;

\echo '== 5. Test / misfiled notes =='
SELECT n.id, b.title, left(n.text, 70) AS text
FROM book_notes n JOIN books b ON b.id = n.book_id
WHERE n.text ~* '(asdasd|test multi-entry|via curl|telkom university)';
