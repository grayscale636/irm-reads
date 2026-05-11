import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBooks } from "@/contexts/BooksContext";
import type { OutletCtx } from "@/layouts/AppLayout";
import { Icon } from "@/components/design/Icons";
import { StatTile } from "@/components/design/StatTile";
import { CurrentlyReading } from "@/components/design/CurrentlyReading";
import { YearHeatmap } from "@/components/design/YearHeatmap";
import { PaceChart } from "@/components/design/PaceChart";
import { DailyLog } from "@/components/design/DailyLog";
import { LogDialog } from "@/components/design/LogDialog";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { today } = useOutletContext<OutletCtx>();
  const { books, readingLogs, stats, isLoading, addReadingLog, deleteReadingLog } = useBooks();

  const [selectedDate, setSelectedDate] = useState(today);
  const [logDialog, setLogDialog] = useState<{ open: boolean; bookId: string | null }>({ open: false, bookId: null });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  const firstName = user?.name.split(" ")[0] || "Reader";
  const todayLabel = useMemo(
    () => new Date(today).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    [today],
  );

  if (isLoading) {
    return (
      <div className="irm-loading"><div className="irm-spinner" /></div>
    );
  }

  return (
    <div className="irm-main">
      <div className="irm-page-head">
        <div>
          <p className="irm-eyebrow">Dashboard</p>
          <h1 className="irm-page-title">{greeting}, {firstName}.</h1>
          <p className="irm-page-sub">
            Here's your reading at a glance — last updated <span className="irm-mono">{todayLabel}</span>.
          </p>
        </div>
        <button className="irm-btn irm-btn--primary irm-page-cta" onClick={() => setLogDialog({ open: true, bookId: null })}>
          <Icon.Plus size={14} /> Log reading
        </button>
      </div>

      <section className="irm-statgrid">
        <StatTile label="Books read" value={stats.booksRead} sub="completed" icon={<Icon.Book size={14} />} />
        <StatTile
          label="Pages read"
          value={stats.pagesRead.toLocaleString()}
          sub="all time"
          icon={<Icon.Pages size={14} />}
        />
        <StatTile
          label="Day streak"
          value={stats.currentStreak}
          sub={stats.currentStreak > 0 ? "keep it going" : "start today"}
          icon={<Icon.Flame size={14} />}
        />
        <StatTile
          label="Avg rating"
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
          sub="completed books"
          icon={<Icon.Star size={14} />}
        />
      </section>

      <CurrentlyReading
        books={books}
        logs={readingLogs}
        today={today}
        onLogReading={(bookId) => setLogDialog({ open: true, bookId })}
        onOpenBook={(id) => navigate(`/book/${id}`)}
      />

      <section className="irm-card">
        <YearHeatmap
          logs={readingLogs}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </section>

      <div className="irm-split">
        <section className="irm-card">
          <PaceChart logs={readingLogs} today={today} />
        </section>
        <section className="irm-card irm-card--daylog">
          <DailyLog
            logs={readingLogs}
            books={books}
            selectedDate={selectedDate}
            today={today}
            onClearDate={() => setSelectedDate(today)}
            onLogReading={() => setLogDialog({ open: true, bookId: null })}
            onDelete={(id) => deleteReadingLog(id)}
          />
        </section>
      </div>

      <LogDialog
        open={logDialog.open}
        onClose={() => setLogDialog({ open: false, bookId: null })}
        books={books}
        defaultBookId={logDialog.bookId}
        defaultDate={selectedDate}
        onSubmit={async ({ bookId, date, startPage, endPage }) => {
          await addReadingLog(bookId, startPage, endPage, date);
          setSelectedDate(date);
        }}
      />
    </div>
  );
}
