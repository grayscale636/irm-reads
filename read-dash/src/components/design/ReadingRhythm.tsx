import type { ReadingLogData } from "@/contexts/BooksContext";
import { dayOfWeekBreakdown } from "@/lib/readingInsights";

interface Props {
  logs: ReadingLogData[];
}

export function ReadingRhythm({ logs }: Props) {
  const rows = dayOfWeekBreakdown(logs);
  const max = Math.max(...rows.map((r) => r.pages), 1);
  const totalPages = rows.reduce((s, r) => s + r.pages, 0);
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const peak = rows.reduce((a, b) => (b.pages > a.pages ? b : a), rows[0]);
  const weekendPages = rows[5].pages + rows[6].pages;
  const weekdayPages = totalPages - weekendPages;
  const isWeekendLeaning = weekendPages > weekdayPages * (5 / 2); // pages/day weighted

  return (
    <div className="irm-insight">
      <div className="irm-insight__head">
        <div>
          <div className="irm-insight__eyebrow">Reading rhythm</div>
          <div className="irm-insight__title irm-insight__title--sub">
            {totalSessions === 0 ? (
              "Weekly pattern"
            ) : (
              <>
                Peak day · <span className="irm-mono">{peak.label}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {totalSessions === 0 ? (
        <div className="irm-insight__empty">
          Log a few sessions to see your weekly pattern.
        </div>
      ) : (
        <>
          <ul className="irm-rhythm">
            {rows.map((r) => {
              const pct = r.pages > 0 ? Math.max(2, Math.round((r.pages / max) * 100)) : 0;
              const isPeak = r.pages > 0 && r.pages === peak.pages;
              return (
                <li
                  key={r.day}
                  className={`irm-rhythm__row${isPeak ? " is-peak" : ""}`}
                  title={`${r.label} · ${r.pages.toLocaleString()} pages · ${r.sessions} session${r.sessions === 1 ? "" : "s"}`}
                >
                  <span className="irm-rhythm__label">{r.label}</span>
                  <div className="irm-rhythm__bar">
                    <div className="irm-rhythm__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="irm-rhythm__pages irm-mono">{r.pages.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
          <div className="irm-rhythm__foot">
            <span className="irm-mono">{totalSessions}</span> sessions ·{" "}
            {isWeekendLeaning ? "Weekend reader" : "Weekday reader"}
          </div>
        </>
      )}
    </div>
  );
}
