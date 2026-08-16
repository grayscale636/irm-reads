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
  quotes?: string[];
}

export interface ReadingLog {
  id: string;
  bookId: string;
  date: string;
  pagesRead: number;
  startPage: number;
  endPage: number;
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
  tags: string[];
  createdAt: string;
}

export interface NoteFields {
  noteType?: NoteType;
  pageRef?: number | null;
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
