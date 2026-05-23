import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "../stores/auth";
import { ApiError } from "@reissulla/api-client";

type ViewState = { kind: "form" } | { kind: "magic-link-sent"; email: string };

export function Register() {
  const signUp = useAuthStore((s) => s.signUp);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<ViewState>({ kind: "form" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const outcome = await signUp(name, email, password);
      if (outcome.status === "signed-in") {
        navigate("/");
      } else {
        setView({ kind: "magic-link-sent", email: outcome.email });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (view.kind === "magic-link-sent") {
    return (
      <section aria-labelledby="register-heading" className="auth-page">
        <h2 id="register-heading">Check your email</h2>
        <p role="status">
          We sent a sign-in link to <strong>{view.email}</strong>. Open it on
          this device — the link expires in 15 minutes.
        </p>
        <p>
          <button
            type="button"
            onClick={() => setView({ kind: "form" })}
            className="link-button"
          >
            Use a different email
          </button>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="register-heading" className="auth-page">
      <h2 id="register-heading">Create an account</h2>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <div className="form-field">
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
