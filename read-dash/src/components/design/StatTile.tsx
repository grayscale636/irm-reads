import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
}

export function StatTile({ label, value, sub, icon }: Props) {
  return (
    <div className="irm-stat">
      <div className="irm-stat__head">
        <span className="irm-stat__icon">{icon}</span>
        <span className="irm-stat__label">{label}</span>
      </div>
      <div className="irm-stat__value">{value}</div>
      {sub && <div className="irm-stat__sub">{sub}</div>}
    </div>
  );
}
