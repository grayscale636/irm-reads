-- Migration 012: cross-media themes. A fixed vocabulary of themes; notes link
-- to 0..n themes so books and games can be browsed by what they're about
-- (Theme → work → note) without embeddings.
CREATE TABLE IF NOT EXISTS themes (
  slug        VARCHAR(40) PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS note_themes (
  note_id    UUID NOT NULL REFERENCES book_notes(id) ON DELETE CASCADE,
  theme_slug VARCHAR(40) NOT NULL REFERENCES themes(slug) ON DELETE CASCADE,
  PRIMARY KEY (note_id, theme_slug)
);
CREATE INDEX IF NOT EXISTS idx_note_themes_theme ON note_themes(theme_slug);

INSERT INTO themes (slug, name, description, sort_order) VALUES
  ('absurditas',   'Absurditas',               'Dunia tanpa makna bawaan, dan cara hidup di dalamnya', 1),
  ('eksistensi',   'Kebebasan & eksistensi',   'Kebebasan, pilihan, tanggung jawab, otentisitas', 2),
  ('makna-hidup',  'Makna hidup',              'Alasan untuk terus hidup dan bertahan', 3),
  ('kematian',     'Kematian & kefanaan',      'Mati, kehilangan, pengorbanan nyawa', 4),
  ('identitas',    'Identitas & kesadaran',    'Diri, pikiran, ingatan, kesadaran, otak', 5),
  ('moralitas',    'Moralitas & etika',        'Baik-jahat, rasa bersalah, pilihan moral', 6),
  ('pengetahuan',  'Pengetahuan & kebenaran',  'Epistemologi, perspektif, kebenaran yang relatif', 7),
  ('penderitaan',  'Penderitaan',              'Derita, putus asa, luka batin', 8),
  ('kebahagiaan',  'Kebahagiaan',              'Apa itu bahagia dan bisakah diukur', 9),
  ('obsesi',       'Obsesi & cinta',           'Cinta, hasrat, obsesi, kepemilikan', 10),
  ('kuasa',        'Kuasa & manipulasi',       'Kendali atas orang lain, dominasi, rahasia', 11),
  ('masyarakat',   'Masyarakat & konformitas', 'Peran sosial, citra, kelas, tuntutan sosial', 12),
  ('iman',         'Iman & Tuhan',             'Agama, iman, yang ilahi', 13),
  ('keluarga',     'Keluarga & pengorbanan',   'Orang tua, anak, pasangan, berkorban demi mereka', 14),
  ('sejarah',      'Sejarah',                  'Latar sejarah, kolonialisme, perang', 15)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;
