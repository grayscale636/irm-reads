import { useEffect, useState } from "react";
import { suggestThemesForText, type Theme, type ThemeSuggestion } from "@/lib/api";

interface Props {
  themes: Theme[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Precomputed suggestions (e.g. review queue). */
  suggestions?: ThemeSuggestion[];
  /** Or: text being written — suggestions are fetched for it (debounced). */
  suggestFromText?: string;
}

// Toggle chips over the fixed theme vocabulary, plus one-click suggestions
// voted by the most similar already-labelled notes.
export function ThemePicker({ themes, value, onChange, suggestions, suggestFromText }: Props) {
  const [fetched, setFetched] = useState<ThemeSuggestion[]>([]);

  useEffect(() => {
    if (suggestFromText === undefined) return;
    const text = suggestFromText.trim();
    if (text.length < 40) {
      setFetched([]);
      return;
    }
    const t = setTimeout(() => {
      suggestThemesForText(text).then(setFetched).catch(() => setFetched([]));
    }, 700);
    return () => clearTimeout(t);
  }, [suggestFromText]);

  if (themes.length === 0) return null;
  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  const name = (slug: string) => themes.find((t) => t.slug === slug)?.name || slug;
  const pending = (suggestions ?? fetched).filter((s) => !value.includes(s.slug));

  return (
    <div style={{ marginTop: 8 }}>
      {pending.length > 0 && (
        <div className="irm-themes__suggested">
          <span className="irm-themes__suggested-label">Suggested</span>
          {pending.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="irm-themes__chip irm-themes__chip--suggested"
              onClick={() => onChange([...value, s.slug])}
              title={`${Math.round(s.confidence * 100)}% of similar labelled notes`}
            >
              + {name(s.slug)}
            </button>
          ))}
        </div>
      )}
      <div className="irm-themes__chips" style={{ marginBottom: 0 }}>
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
    </div>
  );
}
