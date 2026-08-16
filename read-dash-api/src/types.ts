export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt?: string;
}

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
}

export type NoteType = 'note' | 'reflection' | 'question';

export interface BookNote {
  id: string;
  bookId: string;
  userId: string;
  text: string;
  noteType: NoteType;
  pageRef?: number | null;
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
}
