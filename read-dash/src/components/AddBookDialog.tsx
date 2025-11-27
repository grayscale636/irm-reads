import { useState } from "react";
import { BookData } from "@/contexts/BooksContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface AddBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBook: (book: Omit<BookData, "id">) => void | Promise<void>;
}

export const AddBookDialog = ({ open, onOpenChange, onAddBook }: AddBookDialogProps) => {
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    totalPages: "",
    pagesRead: "",
    status: "want-to-read" as BookData["status"],
    startedAt: "",
    finishedAt: "",
    rating: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.author || !formData.totalPages) {
      toast.error("Please fill in all required fields");
      return;
    }

    const totalPages = parseInt(formData.totalPages);
    const pagesRead = formData.status === "completed" 
      ? totalPages 
      : (formData.status === "reading" ? parseInt(formData.pagesRead) || 0 : 0);
    const progress = Math.round((pagesRead / totalPages) * 100);

    const newBook: Omit<BookData, "id"> = {
      title: formData.title,
      author: formData.author,
      cover: "/placeholder.svg",
      rating: formData.status === "completed" ? formData.rating : 0,
      progress: formData.status === "completed" ? 100 : progress,
      status: formData.status,
      pagesRead: pagesRead,
      totalPages: totalPages,
      startedAt: formData.startedAt || undefined,
      finishedAt: formData.status === "completed" ? (formData.finishedAt || new Date().toISOString().split('T')[0]) : undefined,
    };

    onAddBook(newBook);
    toast.success("Book added successfully!");
    onOpenChange(false);
    
    // Reset form
    setFormData({
      title: "",
      author: "",
      totalPages: "",
      pagesRead: "",
      status: "want-to-read",
      startedAt: "",
      finishedAt: "",
      rating: 0,
    });
  };

  const resetForm = () => {
    setFormData({
      title: "",
      author: "",
      totalPages: "",
      pagesRead: "",
      status: "want-to-read",
      startedAt: "",
      finishedAt: "",
      rating: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Add New Book</DialogTitle>
          <DialogDescription>
            Add a book to Myy reading journal
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="The Great Gatsby"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="author">Author *</Label>
            <Input
              id="author"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              placeholder="F. Scott Fitzgerald"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="pages">Total Pages *</Label>
            <Input
              id="pages"
              type="number"
              value={formData.totalPages}
              onChange={(e) => setFormData({ ...formData, totalPages: e.target.value })}
              placeholder="180"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Reading Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: BookData["status"]) =>
                setFormData({ ...formData, status: value, pagesRead: "", rating: 0 })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="want-to-read">Want to Read</SelectItem>
                <SelectItem value="reading">Currently Reading</SelectItem>
                <SelectItem value="completed">Already Finished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show date started for reading or completed */}
          {(formData.status === "reading" || formData.status === "completed") && (
            <div className="space-y-2">
              <Label htmlFor="startedAt">Date Started</Label>
              <Input
                id="startedAt"
                type="date"
                value={formData.startedAt}
                onChange={(e) => setFormData({ ...formData, startedAt: e.target.value })}
              />
            </div>
          )}

          {/* Show pages read for currently reading */}
          {formData.status === "reading" && (
            <div className="space-y-2">
              <Label htmlFor="pagesRead">Pages Read So Far</Label>
              <Input
                id="pagesRead"
                type="number"
                min={0}
                max={parseInt(formData.totalPages) || undefined}
                value={formData.pagesRead}
                onChange={(e) => setFormData({ ...formData, pagesRead: e.target.value })}
                placeholder="0"
              />
            </div>
          )}

          {/* Show finished date and rating for completed */}
          {formData.status === "completed" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="finishedAt">Date Finished</Label>
                <Input
                  id="finishedAt"
                  type="date"
                  value={formData.finishedAt}
                  onChange={(e) => setFormData({ ...formData, finishedAt: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Myy Rating</Label>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        // If clicking on the same star, clear rating
                        const newRating = formData.rating === i + 1 ? 0 : i + 1;
                        setFormData({ ...formData, rating: newRating });
                      }}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 cursor-pointer ${
                          i < formData.rating
                            ? "fill-primary text-primary"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Book
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
