import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Icon } from "@/components/design/Icons";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="irm-auth">
      <div className="irm-auth__panel">
        <div className="irm-auth__brand">
          <span className="irm-logo"><Icon.Logo size={20} /></span>
          <span className="irm-brand-name">IrmReads</span>
        </div>
        <h1 className="irm-auth__title">Welcome back</h1>
        <p className="irm-auth__sub">Sign in to pick up where you left off.</p>
        <form className="irm-auth__form" onSubmit={handleSubmit}>
          <label className="irm-field">
            <span className="irm-field__label">Email</span>
            <input
              className="irm-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
            />
          </label>
          <label className="irm-field">
            <span className="irm-field__label">Password</span>
            <input
              className="irm-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="irm-auth__error">{error}</div>}
          <button
            type="submit"
            className="irm-btn irm-btn--primary irm-auth__submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="irm-auth__switch">
          New to IrmReads? <Link to="/register">Create an account</Link>
        </div>
      </div>
      <div className="irm-auth__quote">
        <div className="irm-auth__quote-mark">"</div>
        <p className="irm-auth__quote-text">
          A reader lives a thousand lives before he dies. The man who never reads lives only one.
        </p>
        <p className="irm-auth__quote-author">— George R.R. Martin</p>
      </div>
    </div>
  );
}
