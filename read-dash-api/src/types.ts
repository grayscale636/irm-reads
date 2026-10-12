export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt?: string;
}

export type MediaType = 'book' | 'game';
export type ProgressUnit = 'page' | 'hour' | 'chapter' | 'percent';

export interface Book {
  id: string;
  userId: string;
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
  mediaType?: MediaType;
  progressUnit?: ProgressUnit;
  metadata?: Record<string, unknown>;
}

export type NoteType = 'note' | 'reflection' | 'question';

export interface BookNote {
  id: string;
  bookId: string;
  userId: string;
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

export interface ReadingLog {
  id: string;
  userId: string;
  bookId: string;
  date: string;
  pagesRead: number;
  startPage: number;
  endPage: number;
  durationMinutes?: number | null;
  checkpoint?: string | null;
}
