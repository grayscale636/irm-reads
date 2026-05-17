import { useMemo } from "react";
import type { ReadingLogData } from "@/contexts/BooksContext";

interface Props {
  logs: ReadingLogData[];
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Calendar year to render. Defaults to the year of `today`. */
  year: number;
  onChangeYear: (year: number) => void;
  /** Earliest year reachable via the year selector (inclusive). */
  minYear: number;
  /** Latest year reachable (inclusive). Usually current calendar year. */
  maxYear: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function intensity(pages: number): 0 | 1 | 2 | 3 | 4 {
  if (pages === 0) return 0;
  if (pages < 10) return 1;
  if (pages < 30) return 2;
  if (pages < 50) return 3;
  return 4;
}

interface Cell {
  date: string;
  day: number;
  month: number;
  pages: number;
  inYear: boolean;
  isFuture: boolean;
}

export function YearHeatmap({
  logs,
  today,
  selectedDate,
  onSelectDate,
  year,
  onChangeYear,
  minYear,
  maxYear,
}: Props) {
  const byDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      map[log.date] = (map[log.date] || 0) + (log.pagesRead || 0);
    }
    return map;
  }, [logs]);

  const { weeks, monthLabels } = useMemo(() => {
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);

    // Sunday on/before Jan 1 → Saturday on/after Dec 31, GitHub-style.
    // Out-of-year cells stay rendered as empty placeholders (level-0).
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const start = new Date(jan1);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(dec31);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const result: Cell[][] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const week: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(cursor);
        const iso = dt.toISOString().slice(0, 10);
        const inYear = dt.getFullYear() === year;
        week.push({
          date: iso,
          day: dt.getDate(),
          month: dt.getMonth(),
          pages: inYear ? byDate[iso] || 0 : 0,
          inYear,
          isFuture: dt > todayDate,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(week);
    }

    // Place a month label above the first week whose first in-year day falls
    // in that month — avoids labels drifting into Dec for early-year grids.
    const labels: Array<{ col: number; name: string }> = [];
    let lastMonth = -1;
    result.forEach((week, idx) => {
      const firstInYear = week.find((c) => c.inYear);
      if (!firstInYear) return;
      if (firstInYear.month !== lastMonth) {
        if (labels.length === 0 || idx - labels[labels.length - 1].col > 3) {
          labels.push({ col: idx, name: MONTH_NAMES[firstInYear.month] });
        }
        lastMonth = firstInYear.month;
      }
    });

    return { weeks: result, monthLabels: labels };
  }, [byDate, today, year]);

  // Stats limited to the selected calendar year.
  const yearPrefix = `${year}-`;
  let totalPages = 0;
  let activeDays = 0;
  for (const [date, pages] of Object.entries(byDate)) {
    if (!date.startsWith(yearPrefix)) continue;
    totalPages += pages;
    if (pages > 0) activeDays += 1;
  }

  // Years available in the side selector (newest first), like the GitHub
  // contribution graph's year list.
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = maxYear; y >= minYear; y--) ys.push(y);
    return ys;
  }, [minYear, maxYear]);

  return (
    <div className="irm-heatmap">
      <div className="irm-heatmap__header">
        <div>
          <div className="irm-heatmap__title">Reading activity</div>
          <div className="irm-heatmap__sub">
            <span className="irm-mono">{totalPages.toLocaleString()}</span> pages across{" "}
            <span className="irm-mono">{activeDays}</span> days in {year}
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

      <div className="irm-heatmap__main">
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
                      const isSelected = day.inYear && day.date === selectedDate;
                      const isToday = day.inYear && day.date === today;
                      const disabled = day.isFuture || !day.inYear;
                      return (
                        <button
                          key={di}
                          type="button"
                          className={
                            `irm-heatmap__cell irm-heatmap__cell--lv${lv}` +
                            (isSelected ? " is-selected" : "") +
                            (isToday ? " is-today" : "") +
                            (day.isFuture ? " is-future" : "") +
                            (!day.inYear ? " is-out" : "")
                          }
                          title={day.inYear && !day.isFuture ? `${day.date} · ${day.pages} pages` : ""}
                          onClick={() => !disabled && onSelectDate(day.date)}
                          disabled={disabled}
                        ></button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {years.length > 1 && (
          <div className="irm-heatmap__yearlist" role="tablist" aria-label="Year">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                role="tab"
                aria-selected={y === year}
                className={`irm-heatmap__yearitem${y === year ? " is-active" : ""}`}
                onClick={() => onChangeYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
