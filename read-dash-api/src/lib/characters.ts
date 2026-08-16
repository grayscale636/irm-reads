/**
 * Extract probable character names from a text chunk using lightweight heuristics.
 * Conservative approach: only extracts names that are likely actual characters,
 * not generic capitalized words.
 *
 * NOTE: Book-specific blocklists (proper nouns, place names, and noise words tuned
 * to a particular text) are deliberately NOT stored in source. They are loaded at
 * runtime from an optional, git-ignored data file so this repository stays free of
 * copyrighted character/place names. See data/character-blacklist.example.json for
 * the expected shape. When the file is absent, extraction still works — it is just
 * noisier.
 */

import fs from 'fs';
import path from 'path';

// Generic Indonesian honorifics — used to detect "Title + Name" patterns.
const TITLE_WORDS = new Set([
  'Sang','Mama','Papa','Tuan','Nyai','Nona','Nyonya','Ibu','Bapak','Pak','Bu',
  'Kamerad','Komandan','Kapten','Letnan','Sersan','Jenderal','Dokter','Haji',
  'Hajjah','Raden','Mas','Nyi','Ki','Ratu','Pangeran','Putri','Raja','Abah',
  'Mayor','Kolonel','Suster','Tante','Oma','Nenek','Kakek','Nona','Mister',
]);

// Generic Indonesian sentence-transition words — stripped from name candidates.
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

/**
 * Optional, git-ignored blocklists tuned to a specific book.
 * Shape: { "nonCharacters": string[], "singleNameBlacklist": string[] }
 *   - nonCharacters: exact phrases that are never characters (places, titles, orgs)
 *   - singleNameBlacklist: single capitalized words to reject as noise
 * Absent/invalid file → empty sets. Override the path with CHARACTER_BLACKLIST_PATH.
 */
function loadBlacklists(): {
  nonCharacters: Set<string>;
  singleNameBlacklist: Set<string>;
} {
  const candidates = [
    process.env.CHARACTER_BLACKLIST_PATH,
    path.join(__dirname, '..', '..', 'data', 'character-blacklist.local.json'),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return {
        nonCharacters: new Set<string>(json.nonCharacters || []),
        singleNameBlacklist: new Set<string>(json.singleNameBlacklist || []),
      };
    } catch {
      // Try the next candidate; missing file is expected and fine.
    }
  }
  return { nonCharacters: new Set(), singleNameBlacklist: new Set() };
}

const { nonCharacters: NON_CHARACTERS, singleNameBlacklist: SINGLE_NAME_BLACKLIST } =
  loadBlacklists();

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

  // Strategy 1: Title + Name — highest confidence (honorific followed by a name)
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

  // Strategy 2: Multi-word capitalized names (2-3 words) — medium confidence.
  // But NOT if first word is a common sentence-start word.
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

  // Remove single-word names that are substrings of longer names,
  // e.g. keep only the fuller "Title + Name" form when both are present.
  const allNames = [...filtered.keys()];
  for (const name of allNames) {
    const words = name.split(/\s+/);
    if (words.length === 1) {
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
