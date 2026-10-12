import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBooks } from "@/contexts/BooksContext";
import {
  getSteamStatus, linkSteam, getSteamLibrary, importSteamGames, syncSteam,
  type SteamStatus, type SteamGame, type Book,
} from "@/lib/api";
import { Icon } from "./Icons";
import { STATUS_ORDER, statusLabel } from "@/lib/media";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Pick {
  targetHours: string;
  status: Book["status"];
}

const TWO_WEEKS = 14 * 24 * 3600;

// Sensible default: recently played → playing, played before → paused, never → want to play.
function defaultStatus(g: SteamGame): Book["status"] {
  if (!g.playtimeMinutes) return "want-to-read";
  const now = Date.now() / 1000;
  return g.lastPlayed && now - g.lastPlayed < TWO_WEEKS ? "reading" : "paused";
}

const hours = (min: number) => (min / 60).toFixed(1);

export function SteamDialog({ open, onClose }: Props) {
  const { refreshData } = useBooks();
  const [status, setStatus] = useState<SteamStatus | null>(null);
  const [profile, setProfile] = useState("");
  const [library, setLibrary] = useState<SteamGame[] | null>(null);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const loadLibrary = () => run("library", async () => setLibrary(await getSteamLibrary()));

  useEffect(() => {
    if (!open) return;
    setPicks({});
    setQuery("");
    setMessage(null);
    run("status", async () => {
      const s = await getSteamStatus();
      setStatus(s);
      if (s.steamId) setLibrary(await getSteamLibrary());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library || []).filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [library, query]);

  if (!open) return null;

  const handleLink = () =>
    run("link", async () => {
      const r = await linkSteam(profile);
      setStatus((s) => ({ configured: s?.configured ?? true, ...r }));
      setLibrary(r.steamId ? await getSteamLibrary() : null);
    });

  const togglePick = (g: SteamGame) =>
    setPicks((prev) => {
      const next = { ...prev };
      if (next[g.appid]) delete next[g.appid];
      else next[g.appid] = { targetHours: "", status: defaultStatus(g) };
      return next;
    });

  const handleImport = () =>
    run("import", async () => {
      const games = Object.entries(picks).map(([appid, p]) => ({
        appid: Number(appid),
        targetHours: parseInt(p.targetHours, 10) || undefined,
        status: p.status,
      }));
      const r = await importSteamGames(games);
      setPicks({});
      await Promise.all([refreshData(), loadLibrary()]);
      setMessage(`${r.created.length} game ditambahin ke shelf.`);
    });

  const handleSync = () =>
    run("sync", async () => {
      const r = await syncSteam();
      await refreshData();
      setMessage(r.updated ? `${r.updated} game ke-update (+${hours(r.minutes)} jam).` : "Nggak ada playtime baru.");
    });

  const pickCount = Object.keys(picks).length;

  return createPortal(
    <div className="irm-dialog__backdrop" onClick={onClose}>
      <div className="irm-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="irm-dialog__head">
          <h3>Steam</h3>
          <button className="irm-iconbtn" onClick={onClose}>
            <Icon.X size={16} />
          </button>
        </div>
        <div className="irm-dialog__body">
          {status && !status.configured && (
            <div className="irm-empty__text">Steam API key belum di-set di server.</div>
          )}

          {status?.configured && (
            <div className="irm-field-row" style={{ alignItems: "flex-end" }}>
              <label className="irm-field" style={{ flex: 1 }}>
                <span className="irm-field__label">
                  {status.steamId ? `Linked: ${status.name || status.steamId}` : "SteamID64 / profile URL"}
                </span>
                <input
                  className="irm-input irm-mono"
                  value={profile}
                  placeholder={status.steamId || "7656119… or steamcommunity.com/id/…"}
                  onChange={(e) => setProfile(e.target.value)}
                />
              </label>
              <button className="irm-btn irm-btn--ghost" onClick={handleLink} disabled={!!busy || (!profile.trim() && !status.steamId)}>
                {profile.trim() ? "Link" : status.steamId ? "Unlink" : "Link"}
              </button>
              {status.steamId && (
                <button className="irm-btn irm-btn--ghost" onClick={handleSync} disabled={!!busy}>
                  {busy === "sync" ? "Syncing…" : "Sync playtime"}
                </button>
              )}
            </div>
          )}

          {busy && busy !== "sync" && <div className="irm-empty__text">Loading…</div>}
          {error && <div className="irm-empty__text" style={{ color: "#dc2626" }}>{error}</div>}
          {message && <div className="irm-empty__text">{message}</div>}

          {library && (
            <>
              {library.length === 0 ? (
                <div className="irm-empty__text">
                  Library kosong — cek privacy Steam: Game details harus Public.
                </div>
              ) : (
                <>
                  <input
                    className="irm-input"
                    value={query}
                    placeholder={`Search ${library.length} games…`}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 360, overflowY: "auto" }}>
                    {visible.map((g) => {
                      const pick = picks[g.appid];
                      return (
                        <li
                          key={g.appid}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line, rgba(0,0,0,.08))", flexWrap: "wrap" }}
                        >
                          <input
                            type="checkbox"
                            checked={!!pick || !!g.bookId}
                            disabled={!!g.bookId}
                            onChange={() => togglePick(g)}
                          />
                          {g.icon && <img src={g.icon} alt="" width={24} height={24} style={{ borderRadius: 4 }} />}
                          <span style={{ flex: 1, minWidth: 140 }}>{g.name}</span>
                          <span className="irm-mono" style={{ opacity: 0.7, fontSize: 12 }}>
                            {g.bookId ? "on shelf" : `${hours(g.playtimeMinutes)}h`}
                          </span>
                          {pick && (
                            <span style={{ display: "flex", gap: 6, width: "100%", paddingLeft: 34 }}>
                              <select
                                className="irm-input"
                                value={pick.status}
                                onChange={(e) => setPicks((p) => ({ ...p, [g.appid]: { ...pick, status: e.target.value as Book["status"] } }))}
                              >
                                {STATUS_ORDER.map((s) => (
                                  <option key={s} value={s}>{statusLabel(s, "game")}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={1}
                                className="irm-input irm-mono"
                                style={{ width: 130 }}
                                value={pick.targetHours}
                                placeholder="target hours"
                                title="Estimated hours to finish (optional)"
                                onChange={(e) => setPicks((p) => ({ ...p, [g.appid]: { ...pick, targetHours: e.target.value } }))}
                              />
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
        <div className="irm-dialog__foot">
          <button className="irm-btn irm-btn--ghost" onClick={onClose}>Close</button>
          <button className="irm-btn irm-btn--primary" disabled={!pickCount || !!busy} onClick={handleImport}>
            <Icon.Check size={14} /> {busy === "import" ? "Importing…" : `Import ${pickCount || ""} game${pickCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
