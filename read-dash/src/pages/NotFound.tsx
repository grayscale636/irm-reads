import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="irm-loading">
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>404</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginTop: 8 }}>
          That page doesn't exist.
        </p>
        <Link to="/" style={{ color: "var(--accent)", marginTop: 16, display: "inline-block" }}>
          Return home
        </Link>
      </div>
    </div>
  );
}
