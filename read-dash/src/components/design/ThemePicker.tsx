import type { Theme } from "@/lib/api";

interface Props {
  themes: Theme[];
  value: string[];
  onChange: (next: string[]) => void;
}

// Toggle chips over the fixed theme vocabulary.
export function ThemePicker({ themes, value, onChange }: Props) {
  if (themes.length === 0) return null;
  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  return (
    <div className="irm-themes__chips" style={{ marginBottom: 0, marginTop: 8 }}>
      {themes.map((t) => (
        <button
          key={t.slug}
          type="button"
          className={`irm-themes__chip${value.includes(t.slug) ? " is-active" : ""}`}
          onClick={() => toggle(t.slug)}
          title={t.description || undefined}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
