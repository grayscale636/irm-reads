import { useMemo } from "react";
import type { ReadingLogData } from "@/contexts/BooksContext";

interface Props {
  logs: ReadingLogData[];
  today: string;
}

export function PaceChart({ logs, today }: Props) {
  const days = useMemo(() => {
    const result: Array<{ date: string; pages: number }> = [];
    const todayDate = new Date(today);
    const byDate: Record<string, number> = {};
    for (const log of logs) {
      byDate[log.date] = (byDate[log.date] || 0) + (log.pagesRead || 0);
    }
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      result.push({ date: iso, pages: byDate[iso] || 0 });
    }
    return result;
  }, [logs, today]);

  const max = Math.max(...days.map((d) => d.pages), 50);
  const total = days.reduce((s, d) => s + d.pages, 0);
  const avg = Math.round(total / 30);

  return (
    <div className="irm-pace">
      <div className="irm-pace__head">
        <div>
          <div className="irm-pace__title">30-day pace</div>
          <div className="irm-pace__sub">
            <span className="irm-mono">{avg}</span> pages/day average
          </div>
        </div>
        <div className="irm-pace__total">
          <span className="irm-mono irm-pace__total-num">{total.toLocaleString()}</span>
          <span className="irm-pace__total-label">pages</span>
        </div>
      </div>
      <div className="irm-pace__bars">
        {days.map((d, i) => (
          <div
            key={i}
            className="irm-pace__bar"
            style={{ height: `${Math.max(2, (d.pages / max) * 100)}%` }}
            title={`${d.date}: ${d.pages} pages`}
          >
            <div className="irm-pace__bar-fill" style={{ opacity: d.pages > 0 ? 1 : 0.15 }}></div>
          </div>
        ))}
      </div>
      <div className="irm-pace__axis">
        <span>30d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
