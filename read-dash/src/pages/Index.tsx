import { useState } from "react";
import { Book, Plus, Search, BarChart3, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookGrid } from "@/components/BookGrid";
import { AddBookDialog } from "@/components/AddBookDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { useBooks, BookData } from "@/contexts/BooksContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterStatus = "all" | "reading" | "completed" | "want-to-read";

const Index = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { books, stats, addBook, isLoading } = useBooks();
  const { user, logout } = useAuth();

  const handleAddBook = async (bookData: Omit<BookData, "id">) => {
    await addBook(bookData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your library...</p>
        </div>
      </div>
    );
  }

  // Filter by status and search query
  const filteredBooks = books.filter(book => {
    const matchesFilter = filter === "all" || book.status === filter;
    const matchesSearch = searchQuery === "" || 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Book className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">IrmReads</h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <NavLink to="/" icon={Book}>Library</NavLink>
              <NavLink to="/dashboard" icon={BarChart3}>Dashboard</NavLink>
            </nav>
            <ThemeToggle />
            <Button 
              onClick={() => setShowAddDialog(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Book
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Books Section */}
        <section>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">My Library</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by title or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={filter === "all" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setFilter("all")}
              >
                All ({books.length})
              </Button>
              <Button 
                variant={filter === "reading" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setFilter("reading")}
              >
                Reading ({stats.booksReading})
              </Button>
              <Button 
                variant={filter === "completed" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setFilter("completed")}
              >
                Completed ({stats.booksRead})
              </Button>
              <Button 
                variant={filter === "want-to-read" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setFilter("want-to-read")}
              >
                Want to Read ({stats.booksWantToRead})
              </Button>
            </div>
          </div>
          
          {filteredBooks.length > 0 ? (
            <BookGrid books={filteredBooks} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Book className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No books found{searchQuery && ` for "${searchQuery}"`}</p>
            </div>
          )}
        </section>
      </main>

      <AddBookDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onAddBook={handleAddBook}
      />
    </div>
  );
};

export default Index;
