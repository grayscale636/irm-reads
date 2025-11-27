import Dexie, { type Table } from 'dexie';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  cover: string;
  rating: number;
  progress: number;
  status: "reading" | "completed" | "want-to-read";
  pagesRead: number;
  totalPages: number;
  reflection?: string;
  startedAt?: string;
  finishedAt?: string;
  quotes?: string[];
}

// Reading log untuk track halaman per hari
export interface ReadingLogRecord {
  id: string;
  bookId: string;
  date: string; // YYYY-MM-DD
  pagesRead: number;
  createdAt: string;
}

export class IrmReadsDB extends Dexie {
  books!: Table<BookRecord>;
  readingLogs!: Table<ReadingLogRecord>;

  constructor() {
    super('IrmReadsDB');
    
    this.version(1).stores({
      books: 'id, title, author, status, rating'
    });

    this.version(2).stores({
      books: 'id, title, author, status, rating',
      readingLogs: 'id, bookId, date, [bookId+date]'
    });
  }
}

export const db = new IrmReadsDB();

// Migrate data from localStorage to IndexedDB
const STORAGE_KEY = "IrmReads-books";

export async function migrateFromLocalStorage(): Promise<void> {
  try {
    // Check if migration already done
    const existingBooks = await db.books.count();
    if (existingBooks > 0) {
      console.log('IndexedDB already has data, skipping migration');
      return;
    }

    // Get data from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const books: BookRecord[] = JSON.parse(stored);
      if (Array.isArray(books) && books.length > 0) {
        await db.books.bulkAdd(books);
        console.log(`Migrated ${books.length} books from localStorage to IndexedDB`);
        
        // Optional: Clear localStorage after successful migration
        // localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Database operations
export async function getAllBooks(): Promise<BookRecord[]> {
  return await db.books.toArray();
}

export async function addBook(book: BookRecord): Promise<string> {
  await db.books.add(book);
  return book.id;
}

export async function updateBook(id: string, updates: Partial<BookRecord>): Promise<void> {
  await db.books.update(id, updates);
}

export async function deleteBook(id: string): Promise<void> {
  await db.books.delete(id);
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  return await db.books.get(id);
}

// Reading Log operations
export async function addReadingLog(log: ReadingLogRecord): Promise<string> {
  await db.readingLogs.add(log);
  return log.id;
}

export async function getReadingLogsByDate(date: string): Promise<ReadingLogRecord[]> {
  return await db.readingLogs.where('date').equals(date).toArray();
}

export async function getReadingLogsByBook(bookId: string): Promise<ReadingLogRecord[]> {
  return await db.readingLogs.where('bookId').equals(bookId).toArray();
}

export async function getAllReadingLogs(): Promise<ReadingLogRecord[]> {
  return await db.readingLogs.toArray();
}

export async function deleteReadingLog(id: string): Promise<void> {
  await db.readingLogs.delete(id);
}

export async function deleteReadingLogsByBook(bookId: string): Promise<void> {
  await db.readingLogs.where('bookId').equals(bookId).delete();
}

// Export database for backup
export async function exportDatabase(): Promise<string> {
  const books = await getAllBooks();
  const readingLogs = await getAllReadingLogs();
  return JSON.stringify({ books, readingLogs }, null, 2);
}

// Import database from backup
export async function importDatabase(jsonString: string): Promise<number> {
  const data = JSON.parse(jsonString);
  
  // Handle old format (array) or new format (object with books and readingLogs)
  if (Array.isArray(data)) {
    await db.books.clear();
    await db.books.bulkAdd(data);
    return data.length;
  } else {
    await db.books.clear();
    await db.readingLogs.clear();
    if (data.books) await db.books.bulkAdd(data.books);
    if (data.readingLogs) await db.readingLogs.bulkAdd(data.readingLogs);
    return (data.books?.length || 0) + (data.readingLogs?.length || 0);
  }
}
