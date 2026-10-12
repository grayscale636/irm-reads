import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  getAllBooks, 
  addBook as apiAddBook, 
  updateBook as apiUpdateBook, 
  deleteBook as apiDeleteBook,
  getAllReadingLogs,
  addReadingLog as apiAddReadingLog,
  deleteReadingLog as apiDeleteReadingLog,
  Book,
  ReadingLog,
  QuoteItem
} from "@/lib/api";

export interface BookData {
  id: string;
  title: string;
  author: string;
  cover: string;
  rating: number;
  progress: number;
  status: "reading" | "completed" | "want-to-read" | "paused" | "dnf";
  pagesRead: number;
  totalPages: number;
  reflection?: string;
  startedAt?: string;
  finishedAt?: string;
  quotes?: (string | QuoteItem)[];
  mediaType?: "book" | "game";
  progressUnit?: "page" | "hour" | "chapter" | "percent";
  metadata?: Record<string, unknown>;
}

export interface ReadingLogData {
  id: string;
  bookId: string;
  date: string;
  pagesRead: number;
  startPage: number;
  endPage: number;
  durationMinutes?: number | null;
  checkpoint?: string | null;
}

export const isBook = (b: Pick<BookData, "mediaType">) => b.mediaType !== "game";

// Optional session metadata (mostly for games): play time + where you stopped.
export interface SessionExtra {
  durationMinutes?: number | null;
  checkpoint?: string | null;
}

// Keep status ↔ progress ↔ finishedAt consistent (mirrors the API guard):
// completed = 100% with a finish date; active/backlog statuses have no finish date.
function normalizeStatus(book: BookData): void {
  if (book.status === "completed") {
    book.pagesRead = book.totalPages;
    book.progress = 100;
    if (!book.finishedAt) book.finishedAt = new Date().toISOString().split('T')[0];
  } else if (book.status === "reading" || book.status === "paused" || book.status === "want-to-read") {
    book.finishedAt = undefined;
  }
}

interface BooksContextType {
  books: BookData[];
  readingLogs: ReadingLogData[];
  isLoading: boolean;
  stats: {
    booksRead: number;
    pagesRead: number;
    currentStreak: number;
    avgRating: number;
    totalBooks: number;
    booksReading: number;
    booksWantToRead: number;
    booksPaused: number;
    booksDnf: number;
  };
  addBook: (book: Omit<BookData, "id">) => Promise<BookData>;
  updateBook: (id: string, updates: Partial<BookData>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  getBook: (id: string) => BookData | undefined;
  addReadingLog: (bookId: string, startPage: number, endPage: number, date?: string, extra?: SessionExtra) => Promise<void>;
  deleteReadingLog: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType | undefined>(undefined);

export function BooksProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<BookData[]>([]);
  const [readingLogs, setReadingLogs] = useState<ReadingLogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to create reading log (internal use)
  const createReadingLog = async (bookId: string, startPage: number, endPage: number, date?: string, extra?: SessionExtra): Promise<void> => {
    const logDate = date || new Date().toISOString().split('T')[0];
    const pagesRead = endPage - startPage;
    const newLog: ReadingLogData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      bookId,
      date: logDate,
      pagesRead,
      startPage,
      endPage,
      durationMinutes: extra?.durationMinutes ?? null,
      checkpoint: extra?.checkpoint ?? null,
    };
    
    await apiAddReadingLog(newLog);
    setReadingLogs((prev) => [...prev, newLog]);
  };

  // Load data from PostgreSQL API
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loadedBooks, loadedLogs] = await Promise.all([
        getAllBooks(),
        getAllReadingLogs()
      ]);
      setBooks(loadedBooks.map(b => ({ ...b, cover: b.cover || '' })));
      setReadingLogs(loadedLogs);
    } catch (error) {
      console.error("Error loading data from API:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = async (): Promise<void> => {
    await loadData();
  };

  const addBook = async (bookData: Omit<BookData, "id">): Promise<BookData> => {
    const newBook: BookData = {
      ...bookData,
      id: Date.now().toString()
    };
    
    await apiAddBook(newBook as Book);
    setBooks((prev) => [...prev, newBook]);
    return newBook;
  };

  const updateBook = async (id: string, updates: Partial<BookData>): Promise<void> => {
    const book = books.find(b => b.id === id);
    if (!book) return;

    const updated = { ...book, ...updates };
    
    // Auto-calculate progress
    if (updates.pagesRead !== undefined || updates.totalPages !== undefined) {
      updated.progress = Math.round((updated.pagesRead / updated.totalPages) * 100);
    }
    
    // Auto-create reading log when pagesRead increases
    if (updates.pagesRead !== undefined && updates.pagesRead > book.pagesRead) {
      await createReadingLog(id, book.pagesRead, updates.pagesRead);
    }
    
    // Auto-complete when pagesRead reaches totalPages (100%)
    // - Skip if user is explicitly changing the status (so paused/dnf stick)
    // - Skip paused/dnf — completing those should be an explicit user action
    if (
      !updates.status &&
      updated.pagesRead >= updated.totalPages &&
      (updated.status === "reading" || updated.status === "want-to-read")
    ) {
      updated.status = "completed";
      updated.progress = 100;
      if (!updated.finishedAt) {
        updated.finishedAt = new Date().toISOString().split('T')[0];
      }
    }
    
    // Completing logs the remaining pages (even when a finishedAt came along).
    if (updates.status === "completed" && book.status !== "completed" && updated.pagesRead < updated.totalPages) {
      await createReadingLog(id, book.pagesRead, updated.totalPages, updated.finishedAt);
    }
    // Auto-set started date when reading
    if (updates.status === "reading" && !updated.startedAt) {
      updated.startedAt = new Date().toISOString().split('T')[0];
    }

    normalizeStatus(updated);

    await apiUpdateBook(id, updated);
    setBooks((prev) =>
      prev.map((book) => (book.id === id ? updated : book))
    );
  };

  const deleteBook = async (id: string): Promise<void> => {
    await apiDeleteBook(id);
    // Reading logs are deleted by CASCADE in PostgreSQL
    setBooks((prev) => prev.filter((book) => book.id !== id));
    setReadingLogs((prev) => prev.filter((log) => log.bookId !== id));
  };

  const getBook = (id: string): BookData | undefined => {
    return books.find((book) => book.id === id);
  };

  // Public addReadingLog function (uses internal createReadingLog)
  const addReadingLog = async (bookId: string, startPage: number, endPage: number, date?: string, extra?: SessionExtra): Promise<void> => {
    await createReadingLog(bookId, startPage, endPage, date, extra);

    // Also update book's pagesRead if endPage is higher
    const book = books.find(b => b.id === bookId);
    if (book && endPage > book.pagesRead) {
      const updated = { ...book, pagesRead: Math.min(endPage, book.totalPages) };
      updated.progress = Math.round((updated.pagesRead / updated.totalPages) * 100);

      // First log on a paused/want-to-read book resumes/starts it.
      if (updated.status === "paused" || updated.status === "want-to-read") {
        updated.status = "reading";
        if (!updated.startedAt) {
          updated.startedAt = date || new Date().toISOString().split('T')[0];
        }
      }

      // Auto-complete when pagesRead reaches totalPages — only for active books.
      if (
        updated.pagesRead >= updated.totalPages &&
        updated.status === "reading"
      ) {
        updated.status = "completed";
        updated.progress = 100;
        if (!updated.finishedAt) {
          updated.finishedAt = new Date().toISOString().split('T')[0];
        }
      }

      await apiUpdateBook(bookId, updated);
      setBooks((prev) =>
        prev.map((b) => (b.id === bookId ? updated : b))
      );
    }
  };

  const deleteReadingLog = async (id: string): Promise<void> => {
    await apiDeleteReadingLog(id);
    setReadingLogs((prev) => prev.filter((log) => log.id !== id));
  };

  // Reading stats count books only — game hours shouldn't inflate pages/streaks/goals.
  const readingBooks = books.filter(isBook);
  const readingBookIds = new Set(readingBooks.map((b) => b.id));
  const completedBooks = readingBooks.filter((b) => b.status === "completed");
  const ratedBooks = completedBooks.filter((b) => b.rating > 0);
  
  const stats = {
    booksRead: completedBooks.length,
    pagesRead: readingBooks.reduce((sum, b) => sum + b.pagesRead, 0),
    currentStreak: calculateStreak(readingLogs.filter((l) => readingBookIds.has(l.bookId))),
    avgRating: ratedBooks.length > 0 
      ? ratedBooks.reduce((sum, b) => sum + b.rating, 0) / ratedBooks.length 
      : 0,
    totalBooks: readingBooks.length,
    booksReading: readingBooks.filter((b) => b.status === "reading").length,
    booksWantToRead: readingBooks.filter((b) => b.status === "want-to-read").length,
    booksPaused: readingBooks.filter((b) => b.status === "paused").length,
    booksDnf: readingBooks.filter((b) => b.status === "dnf").length,
  };

  return (
    <BooksContext.Provider value={{ 
      books, 
      readingLogs,
      isLoading,
      stats, 
      addBook, 
      updateBook, 
      deleteBook, 
      getBook,
      addReadingLog,
      deleteReadingLog,
      refreshData
    }}>
      {children}
    </BooksContext.Provider>
  );
}

// Calculate reading streak based on consecutive days with reading logs
function calculateStreak(logs: ReadingLogData[]): number {
  if (logs.length === 0) return 0;

  // Get unique dates with reading activity
  const activityDates = new Set<string>();
  logs.forEach(log => activityDates.add(log.date));

  // Sort dates descending
  const sortedDates = Array.from(activityDates).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  // Check if most recent activity was today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecentDate = new Date(sortedDates[0]);
  mostRecentDate.setHours(0, 0, 0, 0);
  
  const daysSinceLastActivity = Math.floor(
    (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // If last activity was more than 1 day ago, streak is broken
  if (daysSinceLastActivity > 1) return 0;

  // Count consecutive days
  let streak = 1;
  let currentDate = mostRecentDate;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i]);
    prevDate.setHours(0, 0, 0, 0);
    
    const dayDiff = Math.floor(
      (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (dayDiff === 1) {
      // Consecutive day
      streak++;
      currentDate = prevDate;
    } else if (dayDiff > 1) {
      // Gap found, streak ends
      break;
    }
    // If dayDiff === 0, same day, continue checking
  }

  return streak;
}

export function useBooks() {
  const context = useContext(BooksContext);
  if (context === undefined) {
    throw new Error("useBooks must be used within a BooksProvider");
  }
  return context;
}
