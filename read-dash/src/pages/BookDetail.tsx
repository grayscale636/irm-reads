import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Calendar, BookOpen, Edit, Trash2, Camera, Plus, Quote, X, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { toast } from "sonner";
import { useBooks, BookData, ReadingLogData } from "@/contexts/BooksContext";
import { uploadToMinio, deleteFromMinio, isMinioUrl } from "@/lib/minio";
import { fetchReadingLogs, ReadingLog, deleteReadingLog } from "@/lib/api";

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getBook, updateBook, deleteBook, addReadingLog } = useBooks();
  const [isEditingReflection, setIsEditingReflection] = useState(false);
  const [reflection, setReflection] = useState("");
  const [newQuote, setNewQuote] = useState("");
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [localPagesRead, setLocalPagesRead] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reading History state
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isAddLogDialogOpen, setIsAddLogDialogOpen] = useState(false);
  const [logStartPage, setLogStartPage] = useState(0);
  const [logEndPage, setLogEndPage] = useState(0);

  const book = getBook(id || "");

  // Load reading logs for this book
  useEffect(() => {
    if (id) {
      setIsLoadingLogs(true);
      fetchReadingLogs()
        .then((logs) => {
          const bookLogs = logs.filter((log) => log.bookId === id);
          // Sort by date descending (newest first)
          bookLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setReadingLogs(bookLogs);
        })
        .catch((error) => {
          console.error("Failed to load reading logs:", error);
        })
        .finally(() => {
          setIsLoadingLogs(false);
        });
    }
  }, [id]);

  // Set default start page when opening add log dialog
  useEffect(() => {
    if (isAddLogDialogOpen && book) {
      setLogStartPage(book.pagesRead);
      setLogEndPage(book.pagesRead);
    }
  }, [isAddLogDialogOpen, book]);

  const handleAddLog = async () => {
    if (!book) return;
    
    if (logStartPage >= logEndPage) {
      toast.error("End page must be greater than start page");
      return;
    }
    
    if (logEndPage > book.totalPages) {
      toast.error(`End page cannot exceed total pages (${book.totalPages})`);
      return;
    }

    try {
      // addReadingLog will also update book.pagesRead automatically
      await addReadingLog(book.id, logStartPage, logEndPage);
      
      // Refresh reading logs
      const logs = await fetchReadingLogs();
      const bookLogs = logs.filter((log) => log.bookId === book.id);
      bookLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReadingLogs(bookLogs);
      
      toast.success(`Logged reading: p.${logStartPage} → p.${logEndPage}`);
      setIsAddLogDialogOpen(false);
      setLogStartPage(0);
      setLogEndPage(0);
    } catch (error) {
      toast.error("Failed to add reading log");
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm("Delete this reading log?")) return;
    
    try {
      await deleteReadingLog(logId);
      setReadingLogs((prev) => prev.filter((log) => log.id !== logId));
      toast.success("Reading log deleted");
    } catch (error) {
      toast.error("Failed to delete reading log");
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !book) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setIsUploadingCover(true);
    try {
      // Delete old cover from MinIO if exists
      if (book.cover && isMinioUrl(book.cover)) {
        await deleteFromMinio(book.cover);
      }

      // Upload new cover to MinIO
      const result = await uploadToMinio(file);
      
      if (result.success && result.url) {
        await updateBook(book.id, { cover: result.url });
        toast.success("Cover uploaded to MinIO!");
      } else {
        toast.error(result.error || "Failed to upload cover");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload cover");
    } finally {
      setIsUploadingCover(false);
    }
  };

  useEffect(() => {
    if (book?.reflection) {
      setReflection(book.reflection);
    }
  }, [book?.reflection]);

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Book not found</h1>
          <Link to="/">
            <Button>Back to Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveReflection = async () => {
    await updateBook(book.id, { reflection });
    toast.success("Reflection saved!");
    setIsEditingReflection(false);
  };

  const handleDeleteBook = async () => {
    if (confirm("Are you sure you want to delete this book?")) {
      // Delete cover from MinIO if exists
      if (book.cover && isMinioUrl(book.cover)) {
        await deleteFromMinio(book.cover);
      }
      await deleteBook(book.id);
      toast.success("Book deleted!");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleDeleteBook}
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Book Cover & Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="overflow-hidden border-border shadow-book">
              <div 
                className={`aspect-[2/3] bg-gradient-to-br from-primary/20 to-accent/20 relative group ${isUploadingCover ? 'pointer-events-none' : 'cursor-pointer'}`}
                onClick={() => !isUploadingCover && fileInputRef.current?.click()}
              >
                <img 
                  src={book.cover} 
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
                {isUploadingCover ? (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                      <p className="text-sm">Uploading...</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-white text-center">
                      <Camera className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Change Cover</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold mb-2">{book.title}</h1>
                  <p className="text-muted-foreground">{book.author}</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Myy Rating</p>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          // If clicking on the same star, clear rating
                          const newRating = book.rating === i + 1 ? 0 : i + 1;
                          updateBook(book.id, { rating: newRating });
                        }}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 cursor-pointer ${
                            i < book.rating
                              ? "fill-primary text-primary"
                              : "text-muted-foreground hover:text-primary"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Select 
                      value={book.status} 
                      onValueChange={(value: BookData["status"]) => {
                        updateBook(book.id, { status: value });
                        toast.success("Status updated!");
                      }}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="want-to-read">Want to Read</SelectItem>
                        <SelectItem value="reading">Reading</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pages</span>
                    <span>{book.pagesRead} / {book.totalPages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{book.progress}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reading Details & Reflection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reading Progress */}
            <Card className="border-border shadow-book">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Reading Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Started</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <p className="font-semibold">{book.startedAt || "Not started"}</p>
                    </div>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Finished</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <p className="font-semibold">{book.finishedAt || "Not finished"}</p>
                    </div>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Progress</p>
                    <div className="flex items-center gap-2">
                      <Progress value={book.progress} className="flex-1" />
                      <p className="font-semibold">{book.progress}%</p>
                    </div>
                  </div>
                </div>

                {/* Update Pages Read */}
                {book.status !== "completed" && (
                  <div className="pt-4 border-t border-border">
                    <Label htmlFor="pagesRead" className="text-sm font-medium">
                      Update Pages Read
                    </Label>
                    <div className="flex items-center gap-3 mt-2">
                      <Input
                        id="pagesRead"
                        type="number"
                        min={0}
                        max={book.totalPages}
                        value={localPagesRead !== null ? localPagesRead : book.pagesRead}
                        onChange={(e) => {
                          const pages = Math.min(parseInt(e.target.value) || 0, book.totalPages);
                          setLocalPagesRead(pages);
                        }}
                        onBlur={() => {
                          if (localPagesRead !== null && localPagesRead !== book.pagesRead) {
                            updateBook(book.id, { pagesRead: localPagesRead });
                            toast.success(`Updated to ${localPagesRead} pages`);
                          }
                          setLocalPagesRead(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">/ {book.totalPages} pages</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          updateBook(book.id, { 
                            pagesRead: book.totalPages, 
                            status: "completed",
                            progress: 100
                          });
                          toast.success("Book marked as completed!");
                        }}
                      >
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reflection */}
            <Card className="border-border shadow-book">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>My Reflection</CardTitle>
                  {!isEditingReflection && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingReflection(true)}
                      className="gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingReflection ? (
                  <div className="space-y-4">
                    <Textarea
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                      placeholder="Share Myy thoughts about this book..."
                      className="min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveReflection}>
                        Save Reflection
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingReflection(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground leading-relaxed">
                      {reflection || "No reflection yet. Click Edit to add Myy thoughts about this book."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quotes */}
            <Card className="border-border shadow-book">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Quote className="w-5 h-5 text-primary" />
                    Favorite Quotes
                  </CardTitle>
                  {!isAddingQuote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingQuote(true)}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Quote
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isAddingQuote && (
                  <div className="space-y-3 mb-4 p-4 bg-secondary/30 rounded-lg">
                    <Textarea
                      value={newQuote}
                      onChange={(e) => setNewQuote(e.target.value)}
                      placeholder="Enter a memorable quote from this book..."
                      className="min-h-[100px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        onClick={() => {
                          if (newQuote.trim()) {
                            const quotes = book.quotes || [];
                            updateBook(book.id, { quotes: [...quotes, newQuote.trim()] });
                            setNewQuote("");
                            setIsAddingQuote(false);
                            toast.success("Quote added!");
                          }
                        }}
                      >
                        Save Quote
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewQuote("");
                          setIsAddingQuote(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {book.quotes && book.quotes.length > 0 ? (
                  <div className="space-y-3">
                    {book.quotes.map((quote, index) => (
                      <div 
                        key={index} 
                        className="relative p-4 bg-secondary/30 rounded-lg border-l-4 border-primary group"
                      >
                        <button
                          onClick={() => {
                            const newQuotes = book.quotes?.filter((_, i) => i !== index);
                            updateBook(book.id, { quotes: newQuotes });
                            toast.success("Quote deleted!");
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="text-foreground italic pr-6">"{quote}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  !isAddingQuote && (
                    <p className="text-muted-foreground text-center py-4">
                      No quotes yet. Add Myy favorite quotes from this book!
                    </p>
                  )
                )}
              </CardContent>
            </Card>

            {/* Reading History */}
            <Card className="border-border shadow-book">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" />
                    Reading History
                  </CardTitle>
                  <Dialog open={isAddLogDialogOpen} onOpenChange={setIsAddLogDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Log
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Reading Log</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="startPage">Start Page</Label>
                            <Input
                              id="startPage"
                              type="number"
                              min={0}
                              max={book?.totalPages || 0}
                              value={logStartPage}
                              onChange={(e) => setLogStartPage(parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endPage">End Page</Label>
                            <Input
                              id="endPage"
                              type="number"
                              min={0}
                              max={book?.totalPages || 0}
                              value={logEndPage}
                              onChange={(e) => setLogEndPage(parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Pages read: {Math.max(0, logEndPage - logStartPage)} pages
                        </p>
                        <Button onClick={handleAddLog} className="w-full">
                          Add Reading Log
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : readingLogs.length > 0 ? (
                  <div className="space-y-3">
                    {readingLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <p className="font-medium">
                              p.{log.startPage} → p.{log.endPage}
                            </p>
                            <p className="text-muted-foreground">
                              {log.endPage - log.startPage} pages
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {new Date(log.date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No reading logs yet. Track your reading sessions!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookDetail;
