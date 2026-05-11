import { useMemo } from "react";
import type { ReadingLogData } from "@/contexts/BooksContext";

interface Props {
  logs: ReadingLogData[];
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function intensity(pages: number): 0 | 1 | 2 | 3 | 4 {
  if (pages === 0) return 0;
  if (pages < 10) return 1;
  if (pages < 30) return 2;
  if (pages < 50) return 3;
  return 4;
}

export function YearHeatmap({ logs, today, selectedDate, onSelectDate }: Props) {
  const byDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      map[log.date] = (map[log.date] || 0) + (log.pagesRead || 0);
    }
    return map;
  }, [logs]);

  const { weeks, monthLabels } = useMemo(() => {
    const todayDate = new Date(today);
    const lastDay = new Date(todayDate);
    lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const result: Array<Array<{ date: string; day: number; month: number; pages: number; isFuture: boolean }>> = [];
    const cursor = new Date(lastDay);
    cursor.setDate(cursor.getDate() - 52 * 7 - lastDay.getDay());

    while (cursor <= lastDay) {
      const week: Array<{ date: string; day: number; month: number; pages: number; isFuture: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(cursor);
        const iso = dt.toISOString().slice(0, 10);
        week.push({
          date: iso,
          day: dt.getDate(),
          month: dt.getMonth(),
          pages: byDate[iso] || 0,
          isFuture: dt > todayDate,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(week);
    }

    const labels: Array<{ col: number; name: string }> = [];
    let lastMonth = -1;
    result.forEach((week, idx) => {
      const first = week[0];
      if (first.month !== lastMonth) {
        if (labels.length === 0 || idx - labels[labels.length - 1].col > 3) {
          labels.push({ col: idx, name: MONTH_NAMES[first.month] });
        }
        lastMonth = first.month;
      }
    });

    return { weeks: result, monthLabels: labels };
  }, [byDate, today]);

  const totalPages = Object.values(byDate).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(byDate).filter((v) => v > 0).length;

  return (
    <div className="irm-heatmap">
      <div className="irm-heatmap__header">
        <div>
          <div className="irm-heatmap__title">Reading activity</div>
          <div className="irm-heatmap__sub">
            <span className="irm-mono">{totalPages.toLocaleString()}</span> pages across{" "}
            <span className="irm-mono">{activeDays}</span> days, last 12 months
          </div>
        </div>
        <div className="irm-heatmap__legend">
          <span className="irm-heatmap__legend-label">Less</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className={`irm-heatmap__cell irm-heatmap__cell--lv${lv}`}></span>
          ))}
          <span className="irm-heatmap__legend-label">More</span>
        </div>
      </div>

      <div className="irm-heatmap__scroll">
        <div className="irm-heatmap__grid-wrap">
          <div className="irm-heatmap__months">
            {monthLabels.map((m, i) => (
              <span key={i} className="irm-heatmap__month" style={{ left: `${m.col * 14}px` }}>
                {m.name}
              </span>
            ))}
          </div>
          <div className="irm-heatmap__body">
            <div className="irm-heatmap__daylabels">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="irm-heatmap__grid">
              {weeks.map((week, wi) => (
                <div key={wi} className="irm-heatmap__week">
                  {week.map((day, di) => {
                    const lv = intensity(day.pages);
                    const isSelected = day.date === selectedDate;
                    const isToday = day.date === today;
                    return (
                      <button
                        key={di}
                        type="button"
                        className={
                          `irm-heatmap__cell irm-heatmap__cell--lv${lv}` +
                          (isSelected ? " is-selected" : "") +
                          (isToday ? " is-today" : "") +
                          (day.isFuture ? " is-future" : "")
                        }
                        title={`${day.date} · ${day.pages} pages`}
                        onClick={() => !day.isFuture && onSelectDate(day.date)}
                        disabled={day.isFuture}
                      ></button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
