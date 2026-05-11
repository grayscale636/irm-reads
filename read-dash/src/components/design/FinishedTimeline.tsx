import type { BookData } from "@/contexts/BooksContext";
import { finishedSpans } from "@/lib/readingInsights";
import { useCollapsible } from "@/hooks/use-collapsible";
import { Icon } from "./Icons";

interface Props {
  books: BookData[];
  onOpenBook?: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FinishedTimeline({ books, onOpenBook }: Props) {
  const spans = finishedSpans(books, 12);
  const { open, toggle } = useCollapsible("dashboard-finished", true);

  if (spans.length === 0) {
    return (
      <div>
        <div className="irm-section-head">
          <div>
            <h2 className="irm-section-title">Finished books</h2>
            <p className="irm-section-sub">Timeline shows how long each book took.</p>
          </div>
        </div>
        <div className="irm-card irm-empty" style={{ minHeight: 120 }}>
          <div className="irm-empty__text">No completed books yet — finish one to see the timeline.</div>
        </div>
      </div>
    );
  }

  // Window spans from earliest start to latest finish.
  const minStart = spans.reduce((m, s) => (s.startedAt < m ? s.startedAt : m), spans[0].startedAt);
  const maxFinish = spans.reduce((m, s) => (s.finishedAt > m ? s.finishedAt : m), spans[0].finishedAt);
  const startMs = new Date(minStart).getTime();
  const endMs = new Date(maxFinish).getTime();
  const totalMs = Math.max(1, endMs - startMs);

  const longest = spans.reduce((m, s) => (s.days > m ? s.days : m), 0);
  const fastest = spans.reduce((m, s) => (s.days < m ? s.days : m), spans[0].days);
  const avgDays = Math.round(spans.reduce((sum, s) => sum + s.days, 0) / spans.length);

  return (
    <div>
      <div className="irm-section-head">
        <div>
          <h2 className="irm-section-title">Finished books</h2>
          <p className="irm-section-sub">
            Last <span className="irm-mono">{spans.length}</span> · avg{" "}
            <span className="irm-mono">{avgDays}d</span> · fastest{" "}
            <span className="irm-mono">{fastest}d</span> · longest{" "}
            <span className="irm-mono">{longest}d</span>
          </p>
        </div>
        <button
          type="button"
          className="irm-section-toggle"
          aria-expanded={open}
          onClick={toggle}
        >
          {open ? "Collapse" : "Expand"}
          <span className="irm-section-toggle__chev"><Icon.ChevronDown size={14} /></span>
        </button>
      </div>
      {open && (
      <div className="irm-card">
        <div className="irm-timeline">
          {spans.map((s) => {
            const left = ((new Date(s.startedAt).getTime() - startMs) / totalMs) * 100;
            const width = Math.max(
              1.5,
              ((new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / totalMs) * 100,
            );
            return (
              <div
                key={s.id}
                className="irm-timeline__row"
                onClick={() => onOpenBook?.(s.id)}
                style={onOpenBook ? { cursor: "pointer" } : undefined}
              >
                <div className="irm-timeline__label" title={`${s.title} — ${s.author}`}>
                  <span className="irm-timeline__title">{s.title}</span>
                  <span className="irm-timeline__author">{s.author}</span>
                </div>
                <div className="irm-timeline__track">
                  <div
                    className="irm-timeline__bar"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${s.startedAt} → ${s.finishedAt} (${s.days}d, ${s.totalPages}p)`}
                  />
                </div>
                <div className="irm-timeline__meta">
                  <span className="irm-mono">{s.days}d</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="irm-timeline__axis">
          <span>{formatDate(minStart)}</span>
          <span>{formatDate(maxFinish)}</span>
        </div>
      </div>
      )}
    </div>
  );
}
