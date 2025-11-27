import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Book, 
  TrendingUp, 
  Calendar, 
  Plus,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  X,
  LogOut,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatsCards } from "@/components/StatsCards";
import { ReadingChart } from "@/components/ReadingChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { useBooks } from "@/contexts/BooksContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Dashboard = () => {
  const { books, readingLogs, stats, addReadingLog, deleteReadingLog } = useBooks();
  const { user, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logBookId, setLogBookId] = useState("");
  const [logStartPage, setLogStartPage] = useState("");
  const [logEndPage, setLogEndPage] = useState("");

  // Get reading books for logging
  const readingBooks = books.filter(b => b.status === "reading");

  // Set default start page when book is selected
  const handleBookSelect = (bookId: string) => {
    setLogBookId(bookId);
    const book = books.find(b => b.id === bookId);
    if (book) {
      setLogStartPage(book.pagesRead.toString());
      setLogEndPage("");
    }
  };

  // Get logs for selected date
  const logsForDate = useMemo(() => {
    return readingLogs
      .filter(log => log.date === selectedDate)
      .map(log => ({
        ...log,
        book: books.find(b => b.id === log.bookId)
      }))
      .filter(log => log.book);
  }, [readingLogs, selectedDate, books]);

  // Calculate total pages for selected date
  const totalPagesForDate = logsForDate.reduce((sum, log) => sum + log.pagesRead, 0);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    
    const days: { date: Date; pages: number; isCurrentMonth: boolean }[] = [];
    
    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      const dateStr = date.toISOString().split('T')[0];
      const pages = readingLogs
        .filter(log => log.date === dateStr)
        .reduce((sum, log) => sum + log.pagesRead, 0);
      days.push({ date, pages, isCurrentMonth: false });
    }
    
    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      const pages = readingLogs
        .filter(log => log.date === dateStr)
        .reduce((sum, log) => sum + log.pagesRead, 0);
      days.push({ date, pages, isCurrentMonth: true });
    }
    
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = date.toISOString().split('T')[0];
      const pages = readingLogs
        .filter(log => log.date === dateStr)
        .reduce((sum, log) => sum + log.pagesRead, 0);
      days.push({ date, pages, isCurrentMonth: false });
    }
    
    return days;
  }, [currentMonth, readingLogs]);

  const handleAddLog = async () => {
    if (!logBookId || !logStartPage || !logEndPage) {
      toast.error("Please select a book and enter start/end pages");
      return;
    }

    const startPage = parseInt(logStartPage);
    const endPage = parseInt(logEndPage);
    
    if (endPage <= startPage) {
      toast.error("End page must be greater than start page");
      return;
    }

    const book = books.find(b => b.id === logBookId);
    if (book && endPage > book.totalPages) {
      toast.error(`End page cannot exceed total pages (${book.totalPages})`);
      return;
    }

    await addReadingLog(logBookId, startPage, endPage, selectedDate);
    toast.success(`Logged ${endPage - startPage} pages!`);
    setLogDialogOpen(false);
    setLogBookId("");
    setLogStartPage("");
    setLogEndPage("");
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const getIntensityClass = (pages: number) => {
    if (pages === 0) return "bg-muted";
    if (pages < 10) return "bg-primary/20";
    if (pages < 30) return "bg-primary/40";
    if (pages < 50) return "bg-primary/60";
    return "bg-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <NavLink to="/" icon={Book}>Library</NavLink>
              <NavLink to="/dashboard" icon={BarChart3}>Dashboard</NavLink>
            </nav>
            <ThemeToggle />
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
        {/* Stats Cards */}
        <StatsCards
          booksRead={stats.booksRead}
          pagesRead={stats.pagesRead}
          currentStreak={stats.currentStreak}
          avgRating={stats.avgRating}
        />

        {/* Reading Chart */}
        <Card className="border-border shadow-book">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Reading Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReadingChart books={books} />
          </CardContent>
        </Card>

        {/* Calendar and Daily Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reading Calendar */}
          <Card className="border-border shadow-book">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Reading Calendar
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={prevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-medium min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const dateStr = day.date.toISOString().split('T')[0];
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        aspect-square rounded-md text-xs flex flex-col items-center justify-center gap-0.5 transition-all
                        ${!day.isCurrentMonth ? 'opacity-30' : ''}
                        ${isSelected ? 'ring-2 ring-primary' : ''}
                        ${isToday ? 'font-bold' : ''}
                        ${getIntensityClass(day.pages)}
                        hover:ring-2 hover:ring-primary/50
                      `}
                    >
                      <span>{day.date.getDate()}</span>
                      {day.pages > 0 && (
                        <span className="text-[10px] opacity-80">{day.pages}p</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="w-3 h-3 rounded bg-muted"></div>
                <div className="w-3 h-3 rounded bg-primary/20"></div>
                <div className="w-3 h-3 rounded bg-primary/40"></div>
                <div className="w-3 h-3 rounded bg-primary/60"></div>
                <div className="w-3 h-3 rounded bg-primary"></div>
                <span>More</span>
              </div>
            </CardContent>
          </Card>

          {/* Daily Reading Log */}
          <Card className="border-border shadow-book">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Book className="w-5 h-5 text-primary" />
                  {new Date(selectedDate).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </CardTitle>
                <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                      <Plus className="w-4 h-4" />
                      Log Reading
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Reading Session</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Book</Label>
                        <Select value={logBookId} onValueChange={handleBookSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a book" />
                          </SelectTrigger>
                          <SelectContent>
                            {readingBooks.length > 0 ? (
                              readingBooks.map(book => (
                                <SelectItem key={book.id} value={book.id}>
                                  {book.title} (page {book.pagesRead}/{book.totalPages})
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>
                                No books currently reading
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Page</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Start page"
                            value={logStartPage}
                            onChange={(e) => setLogStartPage(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Page</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="End page"
                            value={logEndPage}
                            onChange={(e) => setLogEndPage(e.target.value)}
                          />
                        </div>
                      </div>
                      {logStartPage && logEndPage && parseInt(logEndPage) > parseInt(logStartPage) && (
                        <p className="text-sm text-muted-foreground text-center">
                          📖 {parseInt(logEndPage) - parseInt(logStartPage)} pages read
                        </p>
                      )}
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={handleAddLog}>
                        Add Reading Log
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {logsForDate.length > 0 ? (
                <div className="space-y-3">
                  {logsForDate.map(log => (
                    <div 
                      key={log.id} 
                      className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg relative group"
                    >
                      <button
                        onClick={() => deleteReadingLog(log.id)}
                        className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                        title="Delete log"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <img 
                        src={log.book?.cover || '/placeholder.svg'} 
                        alt={log.book?.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{log.book?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          p.{log.startPage} → p.{log.endPage}
                        </p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="font-bold text-lg">{log.pagesRead}</p>
                        <p className="text-xs text-muted-foreground">pages</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-3 border-t border-border flex justify-between items-center">
                    <span className="font-medium">Total</span>
                    <span className="font-bold text-xl text-primary">{totalPagesForDate} pages</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No reading logged for this day</p>
                  <p className="text-sm mt-1">Click "Log Reading" to add</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
