import { useMemo } from "react";
import type { ReadingLog } from "@/lib/api";

interface Props {
  logs: ReadingLog[];
  height?: number;
}

export function PaceChart({ logs, height = 60 }: Props) {
  const chart = useMemo(() => {
    if (logs.length < 2) return null;

    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const byDate: { date: string; pages: number }[] = [];
    let lastDate = "";
    let pageSum = 0;
    for (const l of sorted) {
      if (l.date !== lastDate) {
        if (lastDate) byDate.push({ date: lastDate, pages: pageSum });
        lastDate = l.date;
        pageSum = 0;
      }
      pageSum += l.pagesRead;
    }
    if (lastDate) byDate.push({ date: lastDate, pages: pageSum });

    if (byDate.length < 2) return null;

    const maxPages = Math.max(...byDate.map((d) => d.pages));
    const pad = { t: 6, r: 6, b: 6, l: 6 };
    const chartW = Math.max(byDate.length * 16, 80);
    const chartH = height - pad.t - pad.b;

    const pts = byDate.map((d, i) => {
      const x = pad.l + (i / (byDate.length - 1)) * (chartW - pad.l - pad.r);
      const y = pad.t + chartH - (d.pages / maxPages) * chartH;
      return { x, y, date: d.date, pages: d.pages };
    });

    const bottomY = pad.t + chartH;
    const fillPts = `${pad.l},${bottomY} ${pts.map(p => `${p.x},${p.y}`).join(" ")} ${chartW - pad.r},${bottomY}`;

    return { pts, fill: fillPts, maxPages };
  }, [logs, height]);

  if (!chart) return null;

  const w = Math.max(chart.pts.length * 16, 80);
  const h = height;

  return (
    <div className="irm-pace">
      <svg viewBox={`0 0 ${w} ${h}`} className="irm-pace__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pace-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <polygon points={chart.fill} fill="url(#pace-fill)" />
        <polyline
          points={chart.pts.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Hover zones — positioned on the line */}
        {chart.pts.map((p, i) => (
          <g key={i}>
            <title>{p.date} · {p.pages} page{p.pages > 1 ? "s" : ""}</title>
            <circle cx={p.x} cy={p.y} r={5} fill="transparent" className="irm-pace__dot" />
          </g>
        ))}
      </svg>
    </div>
  );
}
