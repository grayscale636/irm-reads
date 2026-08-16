/**
 * Extract probable character names from a text chunk using lightweight heuristics.
 * Conservative approach: only extracts names that are likely actual characters,
 * not generic capitalized words.
 */

const TITLE_WORDS = new Set([
  'Sang','Mama','Papa','Tuan','Nyai','Nona','Nyonya','Ibu','Bapak','Pak','Bu',
  'Kamerad','Komandan','Kapten','Letnan','Sersan','Jenderal','Dokter','Haji',
  'Hajjah','Raden','Mas','Nyi','Ki','Ratu','Pangeran','Putri','Raja','Abah',
  'Mayor','Kolonel','Suster','Tante','Oma','Nenek','Kakek','Nona','Mister',
]);

const TRANSITION_WORDS = new Set([
  'Tapi','Namun','Meskipun','Sementara','Kemudian','Kenyataannya','Ketika',
  'Bahkan','Bagaimanapun','Lalu','Akhirnya','Maka','Jika','Rupanya','Sejenak',
  'Demikianlah','Sebagaimana','Seharusnya','Awalnya','Semula','Selepas','Hanya',
  'Kini','Apakah','Mungkin','Tadinya','Baiklah','Lagipula','Sebab','Apalagi',
  'Sehingga','Kecuali','Semoga','Seandainya','Dengan','Tahukah','Pergilah',
  'Menunggu','Pemakaman','Cintailah','Seketika','Kekhawatiran','Biasanya',
  'Ramalan','Kepada','Bagi','Setelah','Sekali','Entah','Konon','Tetap',
  'Selain','Kedua','Ternyata','Segera','Tiba','Kembali','Pernah',
]);

const NON_CHARACTERS = new Set([
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','Jakarta','Bandung','Yogyakarta','Surabaya','Semarang',
  '***REMOVED***','***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','Kehidupan',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***',
  '***REMOVED***','***REMOVED***','***REMOVED***',
]);

const SINGLE_NAME_BLACKLIST = new Set([
  'Kehidupan','Seorang','Semuanya','Orang','Bahkan','Katakan','Mencoba',
  'Gadis','Tuhan','Segala','Seharusnya','Seseorang','Sebuah','Bagaimanapun',
  'Sebagaimana','Perempuan','Beberapa','Sekali','Seandainya','Sebab',
  'Demikianlah','Tentu','Setiap','Kematian','Delapan','Sampai','Padahal',
  'Terutama','Mungkin','Lelaki','Waktu','Meskipun','Paling','Benar',
  'Suatu','Awalnya','Bagaikan','Menanti','Pernah','Berapa','Sangat',
  'Sebentar','Sambil','Selama','Banyak','Kenapa','Apakah','Mengapa',
  'Lihat','Seketika','Hingga','Begitulah','Memang','Kelak','Bapak',
  'Tahukah','Cinta','Teman','Kadang','Lebih','Betapa','Seolah',
  'Semua','Kecuali','Sayang','Sepanjang','Sebaliknya','Bukan',
  'Keduanya','Daripada','Ramalan','Tenanglah','Pulau','Akhirnya',
  'Kemudian','Segalanya','Kalian','Nyonya','Jangan','Berbuatlah',
  'Bukankah','Pikirkanlah','Lakukanlah','Sekarang','Tampaknya',
  'Bagaimana','Kenyataannya','Baiklah','Masalahnya','Selepas',
  'Jelas','Keadaan','Penduduk','Kepada','Kurang','Selebihnya',
  'Sesungguhnya','Lagipula','Beginilah','Baginya','Siapakah',
  'Ternyata','Kapan','Jumlah','Berita','Pertama','Kembali',
  'Marxis','Itulah','Penerbit','Pustaka','Utama','Indonesia',
  'Malaysia','***REMOVED***','Desain','Anggota','Diterbitkan',
  'Cetakan','Undang','Dilarang','Dicetak','Percetakan','Media',
  'Membaca','Inilah','Lewat','Harapan','Minggu','Sejarah',
  'Budaya','Perihal','Koran','Pelanggaran','Pasal','Nomor',
  'Cipta','Barangsiapa','Semuanya','Kehidupan',
  // Additional noise words
  'Ibunya','Tubuhnya','Tangannya','Wajahnya','Rambutnya',
  'Prajurit','Komunis','Percayalah','Bertahun','Tahukah',
  'Duduk','Hampir','Sesuatu','Wajah','Tempat','Entah',
  'Konon','Perwira','Perang','Bocah','Nasib','Serangan',
  'Pasukan','Pemuda','Ayahnya','Hubungannya','Hidupnya',
  'Baginya','Wajahnya','Rumahnya','Rombongan','Jabatan',
  'Surat','Ternyata','Pintu','Kemunculan','Bendera',
  'Akhir','Mayat','Sambutan','Pahlawan','Pakaian',
  'Umurnya','Merasa','Pertama','Musik','Pemandangan',
  'Percakapan','Jenis','Tokoh','Pemerintah','Surga',
  'Tepat','Cerita','Darahnya','Salah','Penampilan',
  'Kesadaran','Pakaiannya','Udara','Siang','Setengah',
  'Selamat','Mendengar','Sejauh','Semakin','Segera',
  'Terakhir','Rupanya','Percaya','Senja','Dokter',
  'Cukup','Kepala','Peristiwa','Jadilah','Pertanyaan',
  'Aktivitas','Propaganda','Sumber','Tolong','Termasuk',
  'Revolusi','Jawaban','Laporan','Poster','Markas',
  'Pemimpin','Pihak','Melakukan','Ratusan','Tengah',
  'Kisah','Menjelang','Ucapan','Kemarahan','Besok',
  'Pukul','Demikian','Mulai','Tangisan','Lahir',
  'Nasional','Menangis','Jatuh','Dengarkan','Kesehatan',
  'Bentuk','Rambut','Anakku','Paman','Kuburan','Nenek',
  'Kekasih','Pengakuan','Bodoh','Ganti','Siksaan',
  'Tunggu','Perlahan','Kemeja','Tanya','Terminal',
  'Pengunjung','Bunuh','Operasi','Harapannya','Menghilang',
  'Keempat','Kesepian','Makhluk','Sosok','Pisau','Boleh',
  'Menarik','Kencan','Kakak','Ketakutan','Boneka',
  'Memanggil','Bersetubuh','Mencintai',
  // The real noise
  '***REMOVED***',
]);

/**
 * Clean a name candidate: strip trailing period, check transitions, filter noise.
 */
function clean(raw: string): string | null {
  let name = raw.replace(/\s+/g, ' ').trim();
  name = name.replace(/\.+$/, '').trim();
  if (name.length < 3) return null;

  const parts = name.split(/\s+/);
  if (parts.length > 1 && TRANSITION_WORDS.has(parts[0])) {
    name = parts.slice(1).join(' ');
    if (name.length < 3) return null;
  }

  if (NON_CHARACTERS.has(name)) return null;
  return name;
}

/**
 * Extract character names from a text chunk.
 * Conservative: prefers names with titles or multi-word names.
 */
export function extractCharacterNames(text: string): string[] {
  const candidates = new Set<string>();

  // Strategy 1: Title + Name — highest confidence
  // "***REMOVED***won", "***REMOVED***cho", "Mama ***REMOVED***"
  const titleRE = new RegExp(
    `(?:${[...TITLE_WORDS].join('|')})\\s+[A-Z][a-zéèêëàâäîïôöûüç]+`,
    'g'
  );
  const titled = text.match(titleRE);
  if (titled) {
    for (const match of titled) {
      const c = clean(match);
      if (!c) continue;
      candidates.add(c);
      // Also add the base name for common titles
      const words = c.split(/\s+/);
      if (words.length === 2 && ['Sang','Mama','Papa','Kamerad','Nona','Abah','Ratu','Tuan'].includes(words[0])) {
        if (words[1].length >= 4) candidates.add(words[1]);
      }
    }
  }

  // Strategy 2: Multi-word capitalized names (2-3 words) — medium confidence
  // "***REMOVED***", "***REMOVED***deng", "***REMOVED***"
  // But NOT if first word is a common sentence-start word
  const multiRE = /[A-Z][a-zéèêëàâäîïôöûüç]{2,}(?:\s[A-Z][a-zéèêëàâäîïôöûüç]+){1,2}/g;
  const multi = text.match(multiRE);
  if (multi) {
    for (const match of multi) {
      const c = clean(match);
      if (!c || c.split(/\s+/).length < 2) continue;
      if (SINGLE_NAME_BLACKLIST.has(c)) continue;
      candidates.add(c);
    }
  }

  return [...candidates];
}

/**
 * Merge and filter character name lists.
 * Removes names that appear only once across all chunks (likely noise).
 * Keeps names with ≥2 appearances (more likely real characters).
 * Then sorts by frequency descending.
 */
export function mergeCharacterNames(lists: string[][]): Map<string, number> {
  const freq = new Map<string, number>();

  for (const list of lists) {
    for (const name of list) {
      freq.set(name, (freq.get(name) || 0) + 1);
    }
  }

  // Filter by frequency: ≥2 for multi-word, ≥3 for single-word
  const filtered = new Map<string, number>();
  for (const [name, count] of freq) {
    const words = name.split(/\s+/);
    const minFreq = words.length >= 2 ? 2 : 3;
    if (count >= minFreq) {
      filtered.set(name, count);
    }
  }

  // Remove names that are substrings of longer names
  // e.g., "***REMOVED***" (if present) and "***REMOVED***cho" → keep only "***REMOVED***cho"
  const allNames = [...filtered.keys()];
  for (const name of allNames) {
    const words = name.split(/\s+/);
    if (words.length === 1) {
      // Check if there's a longer version that includes this name
      const hasLonger = allNames.some(
        other => other !== name && other.includes(name) && other.split(/\s+/).length > 1
      );
      if (hasLonger) {
        filtered.delete(name);
      }
    }
  }

  // Sort by frequency descending
  return new Map([...filtered.entries()].sort((a, b) => b[1] - a[1]));
}
