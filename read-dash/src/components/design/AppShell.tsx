import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Icon } from "./Icons";
import { UserMenu } from "./UserMenu";

interface Props {
  onAddBook: () => void;
  children: ReactNode;
}

export function AppShell({ onAddBook, children }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const route = location.pathname.startsWith("/dashboard")
    ? "dashboard"
    : location.pathname.startsWith("/journal")
      ? "journal"
      : location.pathname.startsWith("/graph")
        ? "graph"
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
            <button
              className={`irm-nav__item ${route === "journal" ? "is-active" : ""}`}
              onClick={() => navigate("/journal")}
            >
              Journal
            </button>
            <button
              className={`irm-nav__item ${route === "graph" ? "is-active" : ""}`}
              onClick={() => navigate("/graph")}
            >
              Graph
            </button>
          </nav>
          <div className="irm-header__right">
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
