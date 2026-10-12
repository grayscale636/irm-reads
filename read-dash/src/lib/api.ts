// PostgreSQL API Client
const API_BASE = import.meta.env.VITE_API_URL || 'http://192.168.100.220:8211/api';

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * A saved quote. Historically quotes were plain strings; they are now objects
 * carrying date/page/tags. Both shapes may coexist in storage, so always read
 * through `normalizeQuote`.
 */
export interface QuoteItem {
  text: string;
  /** ISO date the quote was saved. Absent on legacy string quotes. */
  date?: string;
  page?: number;
  tags?: string[];
}

export function normalizeQuote(q: string | QuoteItem): QuoteItem {
  return typeof q === 'string' ? { text: q } : q;
}

export type MediaType = 'book' | 'game';
export type ProgressUnit = 'page' | 'hour' | 'chapter' | 'percent';

export interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string;
  rating: number;
  progress: number;
  status: 'reading' | 'completed' | 'want-to-read' | 'paused' | 'dnf';
  pagesRead: number;
  totalPages: number;
  reflection?: string;
  startedAt?: string;
  finishedAt?: string;
  quotes?: (string | QuoteItem)[];
  mediaType?: MediaType;
  progressUnit?: ProgressUnit;
  metadata?: Record<string, unknown>;
}

export interface ReadingLog {
  id: string;
  bookId: string;
  date: string;
  pagesRead: number;
  startPage: number;
  endPage: number;
  durationMinutes?: number | null;
  checkpoint?: string | null;
}

// ============ BOOKS API ============

export async function getAllBooks(): Promise<Book[]> {
  const response = await fetch(`${API_BASE}/books`, {
    headers: getAuthHeaders()
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to fetch books');
  return response.json();
}

export async function getBook(id: string): Promise<Book | undefined> {
  const response = await fetch(`${API_BASE}/books/${id}`, {
    headers: getAuthHeaders()
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Failed to fetch book');
  return response.json();
}

export async function addBook(book: Book): Promise<string> {
  const response = await fetch(`${API_BASE}/books`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(book),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to add book');
  const data = await response.json();
  return data.id;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  const response = await fetch(`${API_BASE}/books/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to update book');
}

export async function deleteBook(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/books/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to delete book');
}

// ============ READING LOGS API ============

export async function getAllReadingLogs(): Promise<ReadingLog[]> {
  const response = await fetch(`${API_BASE}/reading-logs`, {
    headers: getAuthHeaders()
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to fetch reading logs');
  return response.json();
}

// ============ NOTES API ============

export type NoteType = 'note' | 'reflection' | 'question';

export interface BookNote {
  id: string;
  bookId: string;
  text: string;
  noteType: NoteType;
  pageRef?: number | null;
  /** Free-form reference — page number, location, chapter, level, etc. */
  ref?: string | null;
  isSpoiler: boolean;
  /** Image URLs (MinIO / any) attached to this note. */
  images: string[];
  tags: string[];
  createdAt: string;
}

export interface NoteFields {
  noteType?: NoteType;
  pageRef?: number | null;
  ref?: string | null;
  isSpoiler?: boolean;
  images?: string[];
  tags?: string[];
}

export interface JournalNote extends BookNote {
  bookTitle: string;
  bookAuthor: string;
}

export async function getAllNotes(): Promise<JournalNote[]> {
  const response = await fetch(`${API_BASE}/notes`, {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
}

export async function getBookNotes(bookId: string): Promise<BookNote[]> {
  const response = await fetch(`${API_BASE}/notes/book/${bookId}`, {
    headers: getAuthHeaders()
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
}

export async function addBookNote(bookId: string, text: string, fields: NoteFields = {}): Promise<BookNote> {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ bookId, text, ...fields }),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to add note');
  return response.json();
}

export async function updateBookNote(id: string, text: string, fields: NoteFields = {}): Promise<BookNote> {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, ...fields }),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to update note');
  return response.json();
}

export async function deleteBookNote(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to delete note');
}

// ============ AI DRAFTS ============

export type AIDraftMode = 'recap' | 'reflection';

/** One-shot AI draft (recap of progress, or a reflection draft from notes). */
export async function generateAIDraft(bookId: string, mode: AIDraftMode): Promise<string> {
  const response = await fetch(`${API_BASE}/ai/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ bookId, mode }),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) {
    const err = await response.json().catch(() => ({} as { error?: string }));
    throw new Error(err.error || 'Failed to generate draft');
  }
  const data = await response.json();
  return data.draft as string;
}

// Alias for getAllReadingLogs
export const fetchReadingLogs = getAllReadingLogs;

export async function addReadingLog(log: ReadingLog): Promise<string> {
  const response = await fetch(`${API_BASE}/reading-logs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(log),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to add reading log');
  const data = await response.json();
  return data.id;
}

export async function deleteReadingLog(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/reading-logs/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to delete reading log');
}

// Goals
export async function getGoal(year: number): Promise<number | null> {
  const response = await fetch(`${API_BASE}/goals/${year}`, {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) return null;
  const data = await response.json();
  return data.target ?? null;
}

export async function setGoal(year: number, target: number | null): Promise<number | null> {
  const response = await fetch(`${API_BASE}/goals/${year}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ target }),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to set goal');
  const data = await response.json();
  return data.target ?? null;
}

// ============ OCR IMPORT ============

export interface OcrJob {
  jobId: string;
  bookId: string;
  status: 'processing' | 'done' | 'error';
  pageCount: number;
  processedPages: number;
  notesCreated: number;
  error?: string;
  createdAt: number;
}

/** Upload a book file (PDF/image) and start background OCR → auto-notes. */
export async function startOcrImport(bookId: string, file: File): Promise<{ jobId: string }> {
  const form = new FormData();
  form.append('file', file);
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}/ocr/books/${bookId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) {
    const err = await response.json().catch(() => ({} as { error?: string }));
    throw new Error(err.error || 'Failed to start OCR import');
  }
  return response.json();
}

/** Poll an OCR import job. */
export async function getOcrJob(jobId: string): Promise<OcrJob> {
  const response = await fetch(`${API_BASE}/ocr/jobs/${jobId}`, {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to fetch OCR job');
  return response.json();
}

// ============ STEAM API ============

export interface SteamStatus {
  configured: boolean;
  steamId: string | null;
  name: string | null;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtimeMinutes: number;
  lastPlayed: number | null;
  icon: string | null;
  /** Shelf entry id when this game is already imported. */
  bookId: string | null;
}

export interface SteamImportItem {
  appid: number;
  status?: Book['status'];
}

async function steamRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/steam${path}`, { ...init, headers: getAuthHeaders() });
  if (response.status === 401) throw new Error('Unauthorized');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Steam request failed');
  return data as T;
}

export const getSteamStatus = () => steamRequest<SteamStatus>('/status');
export const linkSteam = (profile: string) =>
  steamRequest<{ steamId: string | null; name: string | null }>('/link', { method: 'PUT', body: JSON.stringify({ profile }) });
export const getSteamLibrary = () => steamRequest<SteamGame[]>('/library');
export const importSteamGames = (games: SteamImportItem[]) =>
  steamRequest<{ created: string[] }>('/import', { method: 'POST', body: JSON.stringify({ games }) });
export const syncSteam = () => steamRequest<{ updated: number; minutes: number }>('/sync', { method: 'POST' });
