import { Book, FileText, Flame, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  booksRead: number;
  pagesRead: number;
  currentStreak: number;
  avgRating: number;
}

export const StatsCards = ({ booksRead, pagesRead, currentStreak, avgRating }: StatsCardsProps) => {
  const stats = [
    {
      icon: Book,
      label: "Books Read",
      value: booksRead,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      icon: FileText,
      label: "Pages Read",
      value: pagesRead.toLocaleString(),
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      icon: Flame,
      label: "Day Streak",
      value: currentStreak,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    {
      icon: Star,
      label: "Avg Rating",
      value: avgRating ? avgRating.toFixed(1) : "—",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card 
          key={index} 
          className="book-card border-border overflow-hidden"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
