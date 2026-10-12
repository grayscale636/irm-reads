import { useState } from "react";
import type { BookData } from "@/contexts/BooksContext";
import { formatHours, isSteamGame, playMinutes } from "@/lib/media";
import { Icon } from "./Icons";

interface Props {
  book: BookData;
  today: string;
  onLogSession: (minutes: number, date: string, checkpoint: string | null) => Promise<void>;
}

// Games track time played only — no target or percentage, since story length
// is unknown and "90% done" would spoil the pacing.
export function GamePlaytime({ book, today, onLogSession }: Props) {
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const steam = isSteamGame(book);
  const lastSynced = (book.metadata as Record<string, unknown> | undefined)?.steam_last_synced as string | undefined;

  const submit = async () => {
    const m = parseInt(minutes, 10);
    if (!(m > 0)) return;
    setSaving(true);
    try {
      await onLogSession(m, date, checkpoint.trim() || null);
      setMinutes("");
      setCheckpoint("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="irm-card">
      <div className="irm-section-head">
        <div>
          <h2 className="irm-section-title">Play time</h2>
          <p className="irm-section-sub">
            {steam
              ? `Synced from Steam${lastSynced ? ` · last ${new Date(lastSynced).toLocaleString()}` : ""}`
              : "Log each session you play."}
          </p>
        </div>
      </div>
      <div className="irm-detail__progress-grid">
        <div className="irm-detail__progress-stat">
          <div className="irm-field__label">Started</div>
          <div className="irm-mono irm-detail__progress-val">{book.startedAt || "Not started"}</div>
        </div>
        <div className="irm-detail__progress-stat">
          <div className="irm-field__label">Finished</div>
          <div className="irm-mono irm-detail__progress-val">{book.finishedAt || "Not finished"}</div>
        </div>
        <div className="irm-detail__progress-stat">
          <div className="irm-field__label">Played</div>
          <div className="irm-mono irm-detail__progress-val">{formatHours(playMinutes(book))}</div>
        </div>
      </div>
      {!steam && (
        <div className="irm-detail__pages-row">
          <label className="irm-field">
            <span className="irm-field__label">Log a session</span>
            <div className="irm-detail__pages-inputs">
              <input
                type="date"
                className="irm-input irm-mono"
                style={{ width: 140 }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                type="number"
                className="irm-input irm-mono"
                style={{ width: 90 }}
                min={1}
                value={minutes}
                placeholder="minutes"
                onChange={(e) => setMinutes(e.target.value)}
              />
              <input
                type="text"
                className="irm-input"
                style={{ minWidth: 140, flex: 1 }}
                value={checkpoint}
                placeholder="Checkpoint (optional)"
                onChange={(e) => setCheckpoint(e.target.value)}
              />
              <button className="irm-btn irm-btn--ghost" onClick={submit} disabled={saving || !(parseInt(minutes, 10) > 0)}>
                <Icon.Check size={13} /> Log
              </button>
            </div>
          </label>
        </div>
      )}
    </section>
  );
}
