import { useMemo, useRef, useState } from "react";

interface PaceLog {
  date: string;
  pagesRead: number;
}

interface Props {
  logs: PaceLog[];
  today?: string;
  /** Override SVG viewBox height for compact contexts (default 140). */
  height?: number;
}

interface DayPoint {
  date: string;
  pages: number;
  ma: number; // 7-day moving average
  x: number;
  y: number;
  maY: number;
}

const VB_W = 640;
const DEFAULT_VB_H = 140;
const PAD = { top: 14, right: 12, bottom: 22, left: 28 };

function formatTooltipDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAxisDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const dt = new Date(2000, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const t = 0.5;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t * 2;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function PaceChart({ logs, today, height }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const VB_H = Math.max(60, height ?? DEFAULT_VB_H);

  const data = useMemo(() => {
    if (logs.length === 0) return null;

    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const byDate = new Map<string, number>();
    for (const l of sorted) {
      byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.pagesRead);
    }
    const days: { date: string; pages: number }[] = Array.from(
      byDate,
      ([date, pages]) => ({ date, pages }),
    );
    if (days.length < 2) return null;

    const max = Math.max(...days.map((d) => d.pages));
    const total = days.reduce((s, d) => s + d.pages, 0);
    const avg = total / days.length;
    const peak = days.reduce((a, b) => (b.pages > a.pages ? b : a));

    // 7-point trailing moving average to surface trend.
    const window = Math.min(7, Math.max(3, Math.floor(days.length / 4)));
    const ma: number[] = days.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = days.slice(start, i + 1);
      return slice.reduce((s, d) => s + d.pages, 0) / slice.length;
    });

    // Trend delta: last MA value vs the MA at the midpoint.
    const trendDelta = ma[ma.length - 1] - ma[Math.floor(ma.length / 2)];

    // Tight-but-nice ceiling: ~5-25% headroom over `max`, never the 2× jumps the
    // old 1/2/5/10 ladder produced (peak=220 → 500 looked half-empty).
    const niceMax = (() => {
      if (max <= 0) return 1;
      const step = Math.pow(10, Math.floor(Math.log10(max)));
      const m = max / step;
      const niceM =
        m <= 1.2 ? 1.2 :
        m <= 1.5 ? 1.5 :
        m <= 2 ? 2 :
        m <= 2.5 ? 2.5 :
        m <= 3 ? 3 :
        m <= 4 ? 4 :
        m <= 5 ? 5 :
        m <= 6 ? 6 :
        m <= 8 ? 8 :
        10;
      return niceM * step;
    })();
    const yTicks = [0, niceMax / 2, niceMax];

    const innerW = VB_W - PAD.left - PAD.right;
    const innerH = VB_H - PAD.top - PAD.bottom;
    const stepX = days.length > 1 ? innerW / (days.length - 1) : 0;

    const points: DayPoint[] = days.map((d, i) => ({
      ...d,
      ma: ma[i],
      x: PAD.left + i * stepX,
      y: PAD.top + innerH - (d.pages / niceMax) * innerH,
      maY: PAD.top + innerH - (ma[i] / niceMax) * innerH,
    }));

    const avgY = PAD.top + innerH - (avg / niceMax) * innerH;
    const barW = Math.max(2, Math.min(8, (stepX || innerW) * 0.55));

    return {
      points,
      niceMax,
      yTicks,
      total,
      avg,
      avgY,
      peak,
      innerH,
      innerW,
      barW,
      window,
      trendDelta,
    };
  }, [logs, VB_H]);

  if (!data) return null;
  const {
    points,
    yTicks,
    niceMax,
    total,
    avg,
    avgY,
    peak,
    innerH,
    barW,
    window,
    trendDelta,
  } = data;

  const maPath = smoothPath(points.map((p) => ({ x: p.x, y: p.maY })));

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xInVb = xRatio * VB_W;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = Math.abs(points[i].x - xInVb);
      if (dx < best) {
        best = dx;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const todayPoint =
    today != null ? points.find((p) => p.date === today) ?? null : null;
  const tooltipFlip = hover ? hover.x > VB_W - 140 : false;

  const trendPct = avg > 0 ? Math.round((trendDelta / avg) * 100) : 0;
  const trendUp = trendDelta >= 0;
  const last7 = points.slice(-7).reduce((s, p) => s + p.pages, 0);

  return (
    <div className="irm-pace">
      <div className="irm-pace__head">
        <div>
          <div className="irm-pace__title">Reading pace</div>
          <div className="irm-pace__sub">
            <span className="irm-mono">{points.length}</span> active days
            {points.length >= 4 && (
              <>
                {" · "}
                <span
                  className={`irm-pace__trend irm-pace__trend--${
                    trendUp ? "up" : "down"
                  }`}
                >
                  {trendUp ? "▲" : "▼"} {Math.abs(trendPct)}%
                </span>{" "}
                <span className="irm-pace__trend-label">trend</span>
              </>
            )}
          </div>
        </div>
        <div className="irm-pace__stats">
          <div className="irm-pace__stat">
            <span className="irm-pace__stat-num irm-mono">
              {Math.round(avg)}
            </span>
            <span className="irm-pace__stat-label">avg / day</span>
          </div>
          <div className="irm-pace__stat">
            <span className="irm-pace__stat-num irm-mono">{peak.pages}</span>
            <span className="irm-pace__stat-label">peak</span>
          </div>
          <div className="irm-pace__stat">
            <span className="irm-pace__stat-num irm-mono">
              {last7.toLocaleString()}
            </span>
            <span className="irm-pace__stat-label">last 7d</span>
          </div>
          <div className="irm-pace__stat">
            <span className="irm-pace__stat-num irm-mono">
              {total.toLocaleString()}
            </span>
            <span className="irm-pace__stat-label">total</span>
          </div>
        </div>
      </div>

      <div className="irm-pace__chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="irm-pace__svg"
          preserveAspectRatio="none"
          role="img"
          aria-label="Reading pace over time"
        >
          <defs>
            <linearGradient id="pace-bar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.75} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.3} />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines + labels */}
          {yTicks.map((v, i) => {
            const y = PAD.top + innerH - (v / niceMax) * innerH;
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={VB_W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--ink-muted)"
                  strokeOpacity={0.12}
                  strokeDasharray={i === 0 ? "0" : "2 4"}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--ink-muted)"
                  fontFamily="var(--font-mono)"
                >
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* Average reference line */}
          <g>
            <line
              x1={PAD.left}
              x2={VB_W - PAD.right}
              y1={avgY}
              y2={avgY}
              stroke="var(--ink-muted)"
              strokeOpacity={0.5}
              strokeDasharray="3 3"
              strokeWidth={0.8}
            />
            <text
              x={VB_W - PAD.right - 2}
              y={avgY - 3}
              textAnchor="end"
              fontSize={8}
              fill="var(--ink-muted)"
              fontFamily="var(--font-mono)"
              style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
            >
              avg {Math.round(avg)}
            </text>
          </g>

          {/* Daily bars */}
          {points.map((p, i) => {
            const h = PAD.top + innerH - p.y;
            const isPeak = p.date === peak.date;
            const isHover = hoverIdx === i;
            return (
              <rect
                key={i}
                x={p.x - barW / 2}
                y={p.y}
                width={barW}
                height={Math.max(0.5, h)}
                rx={1.2}
                fill={isPeak ? "var(--accent-strong)" : "url(#pace-bar)"}
                opacity={isHover ? 1 : 0.9}
                className="irm-pace__bar-rect"
              />
            );
          })}

          {/* Moving-average trend line */}
          {points.length >= 3 && (
            <path
              d={maPath}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.9}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3 3"
              className="irm-pace__ma"
            />
          )}

          {/* Today marker */}
          {todayPoint && (
            <line
              x1={todayPoint.x}
              x2={todayPoint.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--ink)"
              strokeOpacity={0.18}
              strokeDasharray="1 3"
            />
          )}

          {/* X-axis labels: ~4 evenly spaced */}
          {(() => {
            const n = points.length;
            const tickCount = Math.min(4, n);
            const indices = Array.from({ length: tickCount }, (_, k) =>
              Math.round((k * (n - 1)) / Math.max(1, tickCount - 1)),
            ).filter((v, i, a) => a.indexOf(v) === i);
            return indices.map((idx) => (
              <text
                key={idx}
                x={points[idx].x}
                y={VB_H - 6}
                textAnchor={
                  idx === 0
                    ? "start"
                    : idx === n - 1
                      ? "end"
                      : "middle"
                }
                fontSize={9}
                fill="var(--ink-muted)"
                fontFamily="var(--font-mono)"
              >
                {formatAxisDate(points[idx].date)}
              </text>
            ));
          })()}

          {/* Hover crosshair */}
          {hover && (
            <g pointerEvents="none">
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--accent)"
                strokeOpacity={0.45}
                strokeWidth={1}
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={3.5}
                fill="var(--accent)"
                stroke="var(--bg-elev, #fff)"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Capture rect */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={VB_W - PAD.left - PAD.right}
            height={innerH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIdx(null)}
          />
        </svg>

        {hover && (
          <div
            className="irm-pace__tooltip"
            style={{
              left: `${(hover.x / VB_W) * 100}%`,
              transform: tooltipFlip
                ? "translate(calc(-100% - 10px), -50%)"
                : "translate(10px, -50%)",
              top: `${(hover.y / VB_H) * 100}%`,
            }}
          >
            <div className="irm-pace__tooltip-date">
              {formatTooltipDate(hover.date)}
            </div>
            <div className="irm-pace__tooltip-row">
              <span className="irm-pace__tooltip-num irm-mono">
                {hover.pages}
              </span>
              <span className="irm-pace__tooltip-label">
                page{hover.pages === 1 ? "" : "s"}
              </span>
            </div>
            <div className="irm-pace__tooltip-meta">
              <span
                className={`irm-pace__delta irm-pace__delta--${
                  hover.pages >= avg ? "up" : "down"
                }`}
              >
                {hover.pages >= avg ? "+" : ""}
                {Math.round(hover.pages - avg)}
              </span>
              <span className="irm-pace__tooltip-meta-label">vs avg</span>
            </div>
            <div className="irm-pace__tooltip-meta">
              <span className="irm-pace__delta irm-mono">
                {Math.round(hover.ma)}
              </span>
              <span className="irm-pace__tooltip-meta-label">
                {window}d trend
              </span>
            </div>
            {hover.date === peak.date && (
              <div className="irm-pace__tooltip-tag">★ peak day</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
