import { BookData } from "@/contexts/BooksContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

interface ReadingChartProps {
  books: BookData[];
}

export const ReadingChart = ({ books }: ReadingChartProps) => {
  // Generate chart data from actual book data
  const data = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const last6Months: { month: string; pages: number; books: number }[] = [];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Count completed books and pages in this month
      const monthBooks = books.filter(book => {
        if (!book.finishedAt) return false;
        const finishedMonth = book.finishedAt.substring(0, 7); // "YYYY-MM"
        return finishedMonth === monthKey;
      });

      last6Months.push({
        month: monthNames[date.getMonth()],
        pages: monthBooks.reduce((sum, b) => sum + b.totalPages, 0),
        books: monthBooks.length
      });
    }

    return last6Months;
  }, [books]);

  const hasData = data.some(d => d.pages > 0 || d.books > 0);

  if (!hasData) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-muted-foreground">
        <p>Complete some books to see myy reading activity!</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis 
            dataKey="month" 
            className="text-muted-foreground"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis 
            className="text-muted-foreground"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number, name: string) => [
              value,
              name === "pages" ? "Pages Read" : "Books Completed"
            ]}
          />
          <Bar 
            dataKey="pages" 
            fill="hsl(var(--primary))" 
            radius={[8, 8, 0, 0]}
            className="hover:opacity-80 transition-opacity"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
