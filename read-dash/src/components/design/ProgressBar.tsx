interface Props {
  value: number;
  max: number;
  height?: number;
}

export function ProgressBar({ value, max, height = 4 }: Props) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));
  return (
    <div className="irm-progress" style={{ height }}>
      <div className="irm-progress__fill" style={{ width: `${pct}%` }}></div>
    </div>
  );
}
