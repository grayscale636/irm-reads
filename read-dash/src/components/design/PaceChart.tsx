import { useMemo, useRef, useState } from "react";
import type { ReadingLog } from "@/lib/api";

interface Props {
  logs: ReadingLog[];
  today?: string;
}

interface DayPoint {
  date: string;
  pages: number;
  x: number;
  y: number;
}

const VB_W = 640;
const VB_H = 200;
const PAD = { top: 18, right: 16, bottom: 26, left: 28 };

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

// Build a smooth cubic-bezier path through the given points (Catmull-Rom → Bezier).
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

export function PaceChart({ logs, today }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

    // Nice ticks for the y axis: 4 evenly-spaced lines including 0 and ceil(max).
    const niceMax = (() => {
      const step = Math.pow(10, Math.floor(Math.log10(max || 1)));
      const m = max / step;
      const niceM = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
      return niceM * step;
    })();
    const yTicks = [0, niceMax / 3, (niceMax * 2) / 3, niceMax];

    const innerW = VB_W - PAD.left - PAD.right;
    const innerH = VB_H - PAD.top - PAD.bottom;
    const stepX = days.length > 1 ? innerW / (days.length - 1) : 0;

    const points: DayPoint[] = days.map((d, i) => ({
      ...d,
      x: PAD.left + i * stepX,
      y: PAD.top + innerH - (d.pages / niceMax) * innerH,
    }));

    return { points, niceMax, yTicks, total, avg, peak, innerH, innerW };
  }, [logs]);

  if (!data) return null;
  const { points, yTicks, niceMax, total, avg, peak, innerH } = data;

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${points[0].x} ${PAD.top + innerH} Z`;

  // Map a clientX to nearest data index.
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

  // Tooltip placement: prefer right of crosshair, flip if too close to right edge.
  const tooltipFlip = hover ? hover.x > VB_W - 140 : false;

  return (
    <div className="irm-pace">
      <div className="irm-pace__head">
        <div>
          <div className="irm-pace__title">Reading pace</div>
          <div className="irm-pace__sub">
            <span className="irm-mono">{points.length}</span> active days
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
              {total.toLocaleString()}
            </span>
            <span className="irm-pace__stat-label">total pages</span>
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
            <linearGradient id="pace-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <filter id="pace-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y-axis gridlines + labels */}
          {yTicks.map((v, i) => {
            const y = PAD.top + innerH - (v / niceMax) * innerH;
            return (
              <g key={i} className="irm-pace__grid">
                <line
                  x1={PAD.left}
                  x2={VB_W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--ink-muted)"
                  strokeOpacity={0.15}
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

          {/* Area + line */}
          <path
            d={areaPath}
            fill="url(#pace-fill)"
            className="irm-pace__area"
          />
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="irm-pace__line"
          />

          {/* Today marker */}
          {todayPoint && (
            <g>
              <line
                x1={todayPoint.x}
                x2={todayPoint.x}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--ink)"
                strokeOpacity={0.18}
                strokeDasharray="2 3"
              />
              <text
                x={todayPoint.x}
                y={PAD.top - 6}
                textAnchor="middle"
                fontSize={8}
                fill="var(--ink-muted)"
                fontFamily="var(--font-mono)"
                style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                today
              </text>
            </g>
          )}

          {/* Peak marker */}
          {points.length > 2 && (
            <circle
              cx={peak ? points.find((p) => p.date === peak.date)!.x : 0}
              cy={peak ? points.find((p) => p.date === peak.date)!.y : 0}
              r={3}
              fill="var(--accent)"
              filter="url(#pace-glow)"
            />
          )}

          {/* X-axis sparse date labels (first / mid / last) */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((idx) => (
              <text
                key={idx}
                x={points[idx].x}
                y={VB_H - 8}
                textAnchor={
                  idx === 0
                    ? "start"
                    : idx === points.length - 1
                      ? "end"
                      : "middle"
                }
                fontSize={9}
                fill="var(--ink-muted)"
                fontFamily="var(--font-mono)"
              >
                {formatAxisDate(points[idx].date)}
              </text>
            ))}

          {/* Hover crosshair + active dot */}
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
                r={6}
                fill="var(--accent)"
                fillOpacity={0.18}
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={3}
                fill="var(--accent)"
                stroke="var(--bg-elev, var(--surface, #fff))"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Capture rect for mouse tracking */}
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
            {hover.pages >= peak.pages && (
              <div className="irm-pace__tooltip-tag">★ peak day</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
