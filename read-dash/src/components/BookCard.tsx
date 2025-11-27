import { BookData } from "@/contexts/BooksContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Star, BookOpen, CheckCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface BookCardProps {
  book: BookData;
}

export const BookCard = ({ book }: BookCardProps) => {
  const statusConfig = {
    reading: { icon: BookOpen, label: "Reading", color: "bg-accent" },
    completed: { icon: CheckCircle, label: "Completed", color: "bg-primary" },
    "want-to-read": { icon: Clock, label: "Want to Read", color: "bg-muted" }
  };

  const config = statusConfig[book.status];
  const StatusIcon = config.icon;

  return (
    <Link to={`/book/${book.id}`}>
      <Card className="book-card border-border overflow-hidden h-full hover:border-primary/50 cursor-pointer group">
        <div className="aspect-[2/3] bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
          <img 
            src={book.cover} 
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Badge className={`absolute top-3 right-3 ${config.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            <p className="text-sm text-muted-foreground">{book.author}</p>
          </div>
          
          {book.status === "reading" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{book.progress}%</span>
              </div>
              <Progress value={book.progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {book.pagesRead} / {book.totalPages} pages
              </p>
            </div>
          )}
          
          {book.status === "completed" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-green-600">100%</span>
              </div>
              <Progress value={100} className="h-2" />
              {book.rating > 0 && (
                <div className="flex items-center gap-1 pt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < book.rating
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
