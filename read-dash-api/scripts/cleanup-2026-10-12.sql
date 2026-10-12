-- One-off data cleanup (decisions confirmed by Gery, 2026-10-12).
-- No BEGIN/COMMIT inside: wrap it.
--   dry-run: (echo "BEGIN;"; cat scripts/cleanup-2026-10-12.sql; echo "ROLLBACK;") | psql -d irmreads
--   apply:   (echo "BEGIN;"; cat scripts/cleanup-2026-10-12.sql; echo "COMMIT;") | psql -d irmreads -v ON_ERROR_STOP=1

\echo '== 1a. Myth of Sisyphus: move note + reflection to the kept (reading) entry =='
UPDATE book_notes SET book_id = '1779024843183' WHERE book_id = 'b-myth-sisyphus' RETURNING id, left(text, 50);
UPDATE books k SET reflection = d.reflection
FROM books d
WHERE k.id = '1779024843183' AND d.id = 'b-myth-sisyphus'
  AND COALESCE(k.reflection, '') = '' AND COALESCE(d.reflection, '') <> ''
RETURNING k.id, k.title;

\echo '== 1b. Delete want-to-read duplicates + test book "asdasd" =='
DELETE FROM books WHERE id IN ('b-myth-sisyphus', 'b-3cf6119c-4a7', '1764313570939')
RETURNING id, title, status;

\echo '== 2. Make status <-> progress <-> finished_at consistent =='
UPDATE books SET
  pages_read  = CASE WHEN status = 'completed' THEN total_pages ELSE pages_read END,
  progress    = CASE WHEN status = 'completed' THEN 100 ELSE progress END,
  finished_at = CASE
    WHEN status = 'completed' THEN COALESCE(finished_at, CURRENT_DATE)
    WHEN status IN ('reading', 'paused', 'want-to-read') THEN NULL
    ELSE finished_at END
WHERE (status = 'completed' AND (progress <> 100 OR pages_read <> total_pages OR finished_at IS NULL))
   OR (status IN ('reading', 'paused', 'want-to-read') AND finished_at IS NOT NULL)
RETURNING id, title, status, progress, pages_read, total_pages, finished_at;

\echo '== 3. Delete duplicate reading logs (keep the earliest) =='
DELETE FROM reading_logs a USING reading_logs b
WHERE a.book_id = b.book_id AND a.date = b.date
  AND a.start_page = b.start_page AND a.end_page = b.end_page
  AND (a.created_at, a.id) > (b.created_at, b.id)
RETURNING a.id, a.date, a.start_page, a.end_page;

\echo '== 4. Delete test / misfiled notes =='
DELETE FROM book_notes WHERE id IN (
  '1620c5e7-f425-4b1d-89e4-17dbbda455aa',
  'f4d7c54f-06cb-444e-af9a-b2c1566310bc',
  'c8d27e4f-e8d3-40d3-afc3-492213d4c495',
  'c256c6a1-4cc7-438d-bcfd-f2279d5e29d7',
  '487361ed-07b5-4cc2-a225-47b385cc5f1a'
) RETURNING id, left(replace(text, E'\n', ' '), 50);
