import { BookData } from "@/contexts/BooksContext";
import { BookCard } from "./BookCard";

interface BookGridProps {
  books: BookData[];
}

export const BookGrid = ({ books }: BookGridProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
};
