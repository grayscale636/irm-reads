import { useEffect, useRef, useState } from "react";
import type { User } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { Icon } from "./Icons";

interface Props {
  user: User;
  onLogout: () => void;
}

const THEME_LABELS: Array<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "sepia", label: "Sepia" },
  { value: "dark", label: "Dark" },
];

export function UserMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initials = (user.name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="irm-usermenu" ref={ref}>
      <button className="irm-avatar" onClick={() => setOpen(!open)}>{initials}</button>
      {open && (
        <div className="irm-usermenu__pop">
          <div className="irm-usermenu__head">
            <div className="irm-usermenu__name">{user.name}</div>
            <div className="irm-usermenu__email">{user.email}</div>
          </div>
          <div className="irm-usermenu__section">Theme</div>
          <div className="irm-usermenu__themes">
            {THEME_LABELS.map((t) => (
              <button
                key={t.value}
                className={`irm-usermenu__theme${theme === t.value ? " is-active" : ""}`}
                onClick={() => setTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="irm-usermenu__item" onClick={onLogout}>
            <Icon.Logout size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
