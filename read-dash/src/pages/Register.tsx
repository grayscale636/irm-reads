import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Icon } from "@/components/design/Icons";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter your name");
    if (!email.includes("@")) return setError("Enter a valid email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords don't match");
    setSubmitting(true);
    try {
      await register(name.trim(), email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <h1 className="irm-auth__title">Create your reading journal</h1>
        <p className="irm-auth__sub">A private place for your books, notes, and quotes.</p>
        <form className="irm-auth__form" onSubmit={handleSubmit}>
          <label className="irm-field">
            <span className="irm-field__label">Name</span>
            <input
              className="irm-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="name"
            />
          </label>
          <label className="irm-field">
            <span className="irm-field__label">Email</span>
            <input
              className="irm-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              autoComplete="new-password"
            />
          </label>
          <label className="irm-field">
            <span className="irm-field__label">Confirm password</span>
            <input
              className="irm-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && <div className="irm-auth__error">{error}</div>}
          <button
            type="submit"
            className="irm-btn irm-btn--primary irm-auth__submit"
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <div className="irm-auth__switch">
          Already have an account? <Link to="/login">Sign in</Link>
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
