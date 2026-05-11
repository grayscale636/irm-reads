import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Icon } from "./Icons";
import { UserMenu } from "./UserMenu";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddBook: () => void;
  children: ReactNode;
}

export function AppShell({ searchQuery, onSearchChange, onAddBook, children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>(".irm-search__input");
        el?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const route = location.pathname.startsWith("/dashboard")
    ? "dashboard"
    : location.pathname.startsWith("/book")
      ? "book"
      : "library";

  return (
    <div className="irm-app">
      <header className="irm-header">
        <div className="irm-header__inner">
          <button className="irm-header__brand" onClick={() => navigate("/dashboard")}>
            <span className="irm-logo"><Icon.Logo size={20} /></span>
            <span className="irm-brand-name">IrmReads</span>
          </button>
          <nav className="irm-nav">
            <button
              className={`irm-nav__item ${route === "library" ? "is-active" : ""}`}
              onClick={() => navigate("/")}
            >
              Library
            </button>
            <button
              className={`irm-nav__item ${route === "dashboard" ? "is-active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
          </nav>
          <div className="irm-header__right">
            <div className="irm-search">
              <Icon.Search size={14} />
              <input
                className="irm-search__input"
                placeholder="Search books, authors…"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (e.target.value && route !== "library") navigate("/");
                }}
              />
              <kbd className="irm-search__kbd">⌘K</kbd>
            </div>
            <button className="irm-iconbtn irm-iconbtn--ghost" title="Add book" onClick={onAddBook}>
              <Icon.Plus size={16} />
            </button>
            {user && <UserMenu user={user} onLogout={logout} />}
          </div>
        </div>
      </header>

      {children}

      <footer className="irm-footer-wrap">
        <div className="irm-footer">
          <span>IrmReads — your private reading journal</span>
          <span className="irm-mono">v0.4 · prototype</span>
        </div>
      </footer>
    </div>
  );
}
