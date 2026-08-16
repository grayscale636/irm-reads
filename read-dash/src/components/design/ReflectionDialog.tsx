import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { StarRating } from "./StarRating";
import { generateAIDraft } from "@/lib/api";

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
];

const RATING_HEADING = "Alasan rating";
const KESAN_PREFIX = "Kesan:";
const ALASAN_PREFIX = "Alasan:";

interface ParsedReflection {
  answers: string[];
  kesan: string;
  alasan: string;
}

// Build markdown from the per-prompt answers, skipping empty ones.
function buildReflection(answers: string[], kesan: string, alasan: string): string {
  const parts = PROMPTS.map((p, i) => [p.heading, answers[i]?.trim()])
    .filter(([, a]) => a)
    .map(([heading, a]) => `**${heading}**\n${a}`);

  const ratingLines: string[] = [];
  if (kesan.trim()) ratingLines.push(`${KESAN_PREFIX} ${kesan.trim().replace(/\s*\n+\s*/g, " ")}`);
  if (alasan.trim()) ratingLines.push(`${ALASAN_PREFIX} ${alasan.trim().replace(/\s*\n+\s*/g, " ")}`);
  if (ratingLines.length) parts.push(`**${RATING_HEADING}**\n${ratingLines.join("\n")}`);

  return parts.join("\n\n");
}

function grabSection(text: string, heading: string): string {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\*\\*${esc}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)`);
  return (text.match(re)?.[1] ?? "").trim();
}

// Best-effort parse of a saved reflection back into per-prompt answers. If the
// text has no recognizable headings (e.g. free-form or legacy), it all lands
// in the first field so nothing is lost.
function parseReflection(text: string): ParsedReflection {
  const answers = PROMPTS.map(() => "");
  let kesan = "";
  let alasan = "";
  if (!text?.trim()) return { answers, kesan, alasan };

  let matchedAny = false;
  PROMPTS.forEach((p, i) => {
    const v = grabSection(text, p.heading);
    if (v) {
      answers[i] = v;
      matchedAny = true;
    }
  });

  // "Alasan rating" holds "Kesan:" and "Alasan:" lines, or legacy free-form text.
  const ratingBlock = grabSection(text, RATING_HEADING);
  if (ratingBlock) {
    matchedAny = true;
    for (const line of ratingBlock.split("\n")) {
      if (line.startsWith(KESAN_PREFIX)) kesan = line.slice(KESAN_PREFIX.length).trim();
      else if (line.startsWith(ALASAN_PREFIX)) alasan = line.slice(ALASAN_PREFIX.length).trim();
    }
    // Legacy free-form reflection → keep it as the reason.
    if (!kesan && !alasan) alasan = ratingBlock;
  }

  if (!matchedAny) answers[0] = text.trim();
  return { answers, kesan, alasan };
}

interface Props {
  open: boolean;
  bookId: string;
  bookTitle: string;
  rating: number;
  onRatingChange: (rating: number) => void | Promise<void>;
  initial?: string;
  onClose: () => void;
  onSave: (reflection: string) => void | Promise<void>;
}

export function ReflectionDialog({
  open,
  bookId,
  bookTitle,
  rating,
  onRatingChange,
  initial,
  onClose,
  onSave,
}: Props) {
  const [answers, setAnswers] = useState<string[]>(PROMPTS.map(() => ""));
  const [kesan, setKesan] = useState("");
  const [alasan, setAlasan] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      const parsed = parseReflection(initial || "");
      setAnswers(parsed.answers);
      setKesan(parsed.kesan);
      setAlasan(parsed.alasan);
      setSaving(false);
      setDrafting(false);
      setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const hasContent = answers.some((a) => a.trim()) || kesan.trim() || alasan.trim();

  const handleDraft = async () => {
    setDrafting(true);
    setError("");
    try {
      const draft = await generateAIDraft(bookId, "reflection");
      const parsed = parseReflection(draft);
      setAnswers(parsed.answers);
      setKesan(parsed.kesan);
      setAlasan(parsed.alasan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal bikin draft.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(buildReflection(answers, kesan, alasan));
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
          <div className="irm-reflect__introrow">
            <p className="irm-reflect__intro">
              Sebelum buku ini masuk arsip, luangin sebentar buat ngerangkum kesanmu. Nggak
              wajib diisi semua — jawab yang kepikiran aja.
            </p>
            <button
              type="button"
              className="irm-btn irm-btn--ghost irm-ai-draft-btn"
              onClick={handleDraft}
              disabled={drafting || saving}
              title="Bikin draft dari catatanmu pakai Bacain"
            >
              {drafting ? (
                <span className="irm-ai-draft-btn__loading">
                  <span className="irm-ai__dot" />
                  <span className="irm-ai__dot" />
                  <span className="irm-ai__dot" />
                </span>
              ) : (
                <>✨ Draftin dari catatan</>
              )}
            </button>
          </div>
          {error && <p className="irm-reflect__error">{error}</p>}
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

          <div className="irm-field irm-reflect__rating">
            <span className="irm-field__label">Rating jujurmu</span>
            <div className="irm-reflect__rating-row">
              <StarRating value={rating} onChange={onRatingChange} />
              {rating > 0 ? (
                <span className="irm-reflect__rating-val">{rating}/5</span>
              ) : (
                <span className="irm-reflect__rating-val irm-reflect__rating-val--empty">
                  belum dirating
                </span>
              )}
            </div>
            <span className="irm-field__label">Kesan</span>
            <input
              className="irm-input"
              value={kesan}
              placeholder="Kesan keseluruhan soal buku ini…"
              onChange={(e) => setKesan(e.target.value)}
            />
            <span className="irm-field__label">Alasan</span>
            <input
              className="irm-input"
              value={alasan}
              placeholder="Kenapa segitu, bukan lebih / kurang…"
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>
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
