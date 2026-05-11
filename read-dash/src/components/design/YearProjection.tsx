import { useState } from "react";
import type { BookData, ReadingLogData } from "@/contexts/BooksContext";
import { yearPace } from "@/lib/readingInsights";
import { useYearlyGoal } from "@/hooks/use-yearly-goal";
import { Icon } from "./Icons";

interface Props {
  books: BookData[];
  logs: ReadingLogData[];
  today: string;
}

export function YearProjection({ books, logs, today }: Props) {
  const pace = yearPace(books, logs, today);
  const yearPct = Math.round((pace.daysElapsed / pace.daysTotal) * 100);
  const { goal, setGoal } = useYearlyGoal(pace.year);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(goal?.toString() ?? "24");

  const goalPct = goal ? Math.min(100, Math.round((pace.booksThisYear / goal) * 100)) : null;
  // Books we *should* have read by now to be on pace for the goal.
  const expectedByNow = goal ? (goal * pace.daysElapsed) / pace.daysTotal : null;
  const delta = expectedByNow !== null ? pace.booksThisYear - expectedByNow : null;
  const onTrack = delta !== null && delta >= 0;

  const save = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n > 0) {
      setGoal(n);
    } else if (draft.trim() === "") {
      setGoal(null);
    }
    setEditing(false);
  };

  return (
    <div className="irm-insight">
      <div className="irm-insight__head">
        <div>
          <div className="irm-insight__eyebrow">On pace for {pace.year}</div>
          <div className="irm-insight__title">
            <span className="irm-mono">{pace.projectedBooks}</span> books
          </div>
        </div>
        <span className="irm-pill irm-pill--reading">{yearPct}% of year</span>
      </div>

      <div className="irm-insight__bar">
        <div className="irm-insight__bar-track">
          <div className="irm-insight__bar-fill" style={{ width: `${yearPct}%` }} />
        </div>
        <div className="irm-insight__bar-axis">
          <span>Jan 1</span>
          <span className="irm-mono">{pace.daysElapsed}d / {pace.daysTotal}d</span>
          <span>Dec 31</span>
        </div>
      </div>

      {/* Goal block */}
      <div className="irm-goal">
        <div className="irm-goal__head">
          <span className="irm-insight__row-label">Yearly goal</span>
          {!editing ? (
            <button
              className="irm-goal__edit"
              onClick={() => {
                setDraft(goal?.toString() ?? "24");
                setEditing(true);
              }}
              title={goal ? "Change goal" : "Set goal"}
            >
              {goal ? (
                <>
                  <span className="irm-mono">{goal}</span> books
                </>
              ) : (
                <>
                  <Icon.Plus size={11} /> Set goal
                </>
              )}
            </button>
          ) : (
            <span className="irm-goal__editrow">
              <input
                type="number"
                className="irm-input irm-goal__input irm-mono"
                value={draft}
                min={1}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button className="irm-btn irm-btn--ghost irm-goal__save" onClick={save}>
                <Icon.Check size={12} />
              </button>
            </span>
          )}
        </div>
        {goal && (
          <>
            <div className="irm-insight__bar-track" style={{ height: 4 }}>
              <div
                className={`irm-insight__bar-fill${onTrack ? "" : " irm-goal__behind"}`}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <div className="irm-goal__delta">
              {delta !== null && (
                <>
                  <span className={onTrack ? "irm-goal__ahead" : "irm-goal__behind-text"}>
                    {onTrack
                      ? `Ahead by ${(+delta).toFixed(1)} book${Math.abs(delta) >= 1.5 ? "s" : ""}`
                      : `Behind by ${Math.abs(+delta).toFixed(1)} book${Math.abs(delta) >= 1.5 ? "s" : ""}`}
                  </span>
                  <span className="irm-mono irm-goal__pct">{goalPct}%</span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="irm-insight__rows">
        <div className="irm-insight__row">
          <span className="irm-insight__row-label">Finished YTD</span>
          <span className="irm-mono">{pace.booksThisYear} books</span>
        </div>
        <div className="irm-insight__row">
          <span className="irm-insight__row-label">Pages YTD</span>
          <span className="irm-mono">{pace.pagesThisYear.toLocaleString()}</span>
        </div>
        <div className="irm-insight__row">
          <span className="irm-insight__row-label">Projected pages</span>
          <span className="irm-mono">{pace.projectedPages.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
