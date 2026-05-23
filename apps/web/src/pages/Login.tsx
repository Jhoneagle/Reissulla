import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "../stores/auth";
import { ApiError } from "@reissulla/api-client";

type ViewState = { kind: "form" } | { kind: "magic-link-sent"; email: string };

export function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const requestMagicLink = useAuthStore((s) => s.requestMagicLink);
  const navigate = useNavigate();
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
      const outcome = await signIn(email, password);
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

  async function handleMagicLinkOnly() {
    setError("");
    setSubmitting(true);
    try {
      await requestMagicLink(email);
      setView({ kind: "magic-link-sent", email });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't send the sign-in email. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (view.kind === "magic-link-sent") {
    return (
      <section aria-labelledby="login-heading" className="auth-page">
        <h2 id="login-heading">Check your email</h2>
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
    <section aria-labelledby="login-heading" className="auth-page">
      <h2 id="login-heading">Log in</h2>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div id="login-error" role="alert" className="form-error">
            {error}
          </div>
        )}
        <div className="form-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <div className="form-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p>
        Forgot your password, or prefer email-only?{" "}
        <button
          type="button"
          onClick={handleMagicLinkOnly}
          disabled={submitting || !email}
          className="link-button"
        >
          Email me a sign-in link
        </button>
      </p>
      <p className="auth-switch">
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
