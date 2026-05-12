import { useMemo } from "react";
import type { ReadingLog } from "@/lib/api";

interface Props {
  logs: ReadingLog[];
  height?: number;
}

export function PaceChart({ logs, height = 140 }: Props) {
  const points = useMemo(() => {
    if (logs.length === 0) return null;

    // Sort chronologically and aggregate by date
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

    // Build SVG polyline points
    const w = byDate.length * 20;
    const h = height - 24;
    const pad = 12;
    const chartW = w;
    const chartH = h - pad * 2;

    const pts = byDate.map((d, i) => {
      const x = pad + (i / (byDate.length - 1)) * (chartW - pad * 2);
      const y = pad + chartH - (d.pages / maxPages) * chartH;
      return `${x},${y}`;
    });

    // Fill area: start from bottom, add poly points, back to bottom
    const firstX = pad;
    const lastX = chartW - pad;
    const bottomY = pad + chartH;
    const fillPts = `${firstX},${bottomY} ${pts.join(" ")} ${lastX},${bottomY}`;

    return { pts: pts.join(" "), fill: fillPts, byDate, maxPages };
  }, [logs, height]);

  if (!points) return null;

  const w = points.byDate.length * 20;
  const h = height;
  // Downsample labels if too many
  const labelEvery = points.byDate.length > 10
    ? Math.ceil(points.byDate.length / 8)
    : 1;

  return (
    <div className="irm-pace">
      <svg viewBox={`0 0 ${w} ${h}`} className="irm-pace__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pace-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        {/* Fill area under the line */}
        <polygon points={points.fill} fill="url(#pace-fill)" />
        {/* Line */}
        <polyline
          points={points.pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.byDate.map((d, i) => {
          const x = 12 + (i / (points.byDate.length - 1)) * (w - 24);
          const y = 12 + (height - 24) - (d.pages / points.maxPages) * (height - 24) - 12;
          return (
            <circle key={i} cx={x} cy={y + 12} r={3} fill="var(--accent)" opacity={0.8} />
          );
        })}
        {/* X-axis labels */}
        {points.byDate.map((d, i) => {
          if (i % labelEvery !== 0 && i !== points.byDate.length - 1) return null;
          const x = 12 + (i / (points.byDate.length - 1)) * (w - 24);
          return (
            <text key={i} x={x} y={h - 2} textAnchor="middle" fill="var(--text-muted)"
              fontSize={9} fontFamily="var(--font-mono)">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
