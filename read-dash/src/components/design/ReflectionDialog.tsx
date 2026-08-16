import { useEffect, useState } from "react";
import { Icon } from "./Icons";

/**
 * Guided prompts shown when a reader finishes a book. Each answer is stored
 * under its `heading` so the saved reflection is readable markdown AND can be
 * parsed back into fields when the reader edits it later.
 */
const PROMPTS: Array<{ heading: string; label: string; placeholder: string }> = [
  {
    heading: "Yang paling nempel",
    label: "Satu ide atau momen yang paling nempel?",
    placeholder: "Hal yang bakal kamu inget dari buku ini…",
  },
  {
    heading: "Rekomendasiin ke",
    label: "Bakal kamu rekomendasiin ke siapa? Kenapa?",
    placeholder: "Cocok buat orang yang…",
  },
  {
    heading: "Alasan rating",
    label: "Rating jujurmu — apa alasannya?",
    placeholder: "Kenapa segitu, bukan lebih / kurang…",
  },
];

// Build markdown from the per-prompt answers, skipping empty ones.
function buildReflection(answers: string[]): string {
  return PROMPTS.map((p, i) => [p.heading, answers[i]?.trim()])
    .filter(([, a]) => a)
    .map(([heading, a]) => `**${heading}**\n${a}`)
    .join("\n\n");
}

// Best-effort parse of a saved reflection back into per-prompt answers. If the
// text has no recognizable headings (e.g. free-form or legacy), it all lands
// in the first field so nothing is lost.
function parseReflection(text: string): string[] {
  const answers = PROMPTS.map(() => "");
  if (!text?.trim()) return answers;

  let matchedAny = false;
  for (let i = 0; i < PROMPTS.length; i++) {
    const heading = PROMPTS[i].heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\*\\*${heading}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)`);
    const m = text.match(re);
    if (m) {
      answers[i] = m[1].trim();
      matchedAny = true;
    }
  }
  if (!matchedAny) answers[0] = text.trim();
  return answers;
}

interface Props {
  open: boolean;
  bookTitle: string;
  initial?: string;
  onClose: () => void;
  onSave: (reflection: string) => void | Promise<void>;
}

export function ReflectionDialog({ open, bookTitle, initial, onClose, onSave }: Props) {
  const [answers, setAnswers] = useState<string[]>(PROMPTS.map(() => ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAnswers(parseReflection(initial || ""));
      setSaving(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const hasContent = answers.some((a) => a.trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(buildReflection(answers));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="irm-dialog__backdrop" onClick={onClose}>
      <div className="irm-dialog irm-dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="irm-dialog__head">
          <h3>Refleksi — {bookTitle}</h3>
          <button className="irm-iconbtn" onClick={onClose}>
            <Icon.X size={16} />
          </button>
        </div>
        <div className="irm-dialog__body">
          <p className="irm-reflect__intro">
            Sebelum buku ini masuk arsip, luangin sebentar buat ngerangkum kesanmu. Nggak
            wajib diisi semua — jawab yang kepikiran aja.
          </p>
          {PROMPTS.map((p, i) => (
            <label className="irm-field" key={p.heading}>
              <span className="irm-field__label">{p.label}</span>
              <textarea
                className="irm-input irm-textarea"
                rows={3}
                value={answers[i]}
                placeholder={p.placeholder}
                onChange={(e) =>
                  setAnswers((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))
                }
                autoFocus={i === 0}
              />
            </label>
          ))}
        </div>
        <div className="irm-dialog__foot">
          <button className="irm-btn irm-btn--ghost" onClick={onClose}>
            Nanti aja
          </button>
          <button
            className="irm-btn irm-btn--primary"
            disabled={!hasContent || saving}
            onClick={handleSave}
          >
            <Icon.Check size={14} /> Simpan refleksi
          </button>
        </div>
      </div>
    </div>
  );
}
