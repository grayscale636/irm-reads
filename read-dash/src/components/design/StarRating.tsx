import { Icon } from "./Icons";

interface Props {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 18 }: Props) {
  return (
    <div className="irm-stars">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className={`irm-stars__btn ${s <= value ? "is-on" : ""}`}
          onClick={() => onChange(s === value ? 0 : s)}
          aria-label={`${s} star${s > 1 ? "s" : ""}`}
        >
          <Icon.Star size={size} filled={s <= value} />
        </button>
      ))}
    </div>
  );
}
