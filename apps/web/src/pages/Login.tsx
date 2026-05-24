import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { FormattedMessage, useIntl } from "react-intl";
import { useAuthStore } from "../stores/auth";
import { ApiError } from "@reissulla/api-client";
import { FormErrorSummary } from "../components/FormErrorSummary";

type ViewState = { kind: "form" } | { kind: "magic-link-sent"; email: string };

export function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const requestMagicLink = useAuthStore((s) => s.requestMagicLink);
  const navigate = useNavigate();
  const intl = useIntl();
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
        setError(intl.formatMessage({ id: "auth.error.unexpected" }));
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
        setError(intl.formatMessage({ id: "auth.error.sendLink" }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (view.kind === "magic-link-sent") {
    return (
      <section aria-labelledby="login-heading" className="auth-page">
        <h2 id="login-heading">
          <FormattedMessage id="auth.checkEmail.title" />
        </h2>
        <p role="status">
          <FormattedMessage
            id="auth.checkEmail.body"
            values={{ email: <strong>{view.email}</strong> }}
          />
        </p>
        <p>
          <button
            type="button"
            onClick={() => setView({ kind: "form" })}
            className="btn btn--link"
          >
            <FormattedMessage id="auth.checkEmail.useDifferentEmail" />
          </button>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="login-heading" className="auth-page">
      <h2 id="login-heading">
        <FormattedMessage id="login.heading" />
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <FormErrorSummary id="login-error" errors={error ? [error] : []} />
        <div className="form-field">
          <label htmlFor="login-email">
            <FormattedMessage id="login.email" />
          </label>
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
          <label htmlFor="login-password">
            <FormattedMessage id="login.password" />
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="login-password-help"
          />
          <p id="login-password-help" className="help">
            <FormattedMessage id="login.passwordOptionalHelp" />
          </p>
        </div>
        {/* Dual-affordance: password sign-in and magic-link sign-in get
            equal-weight primary buttons. Password is only required for
            the left button; the right one works on email alone. */}
        <div className="auth-actions" role="group" aria-label="Sign in">
          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="btn btn--primary"
          >
            <FormattedMessage
              id={submitting ? "login.submitting" : "login.submitPassword"}
            />
          </button>
          <button
            type="button"
            onClick={handleMagicLinkOnly}
            disabled={submitting || !email}
            className="btn btn--primary"
          >
            <FormattedMessage id="login.submitMagicLink" />
          </button>
        </div>
      </form>
      <p className="auth-switch">
        <FormattedMessage id="login.noAccount" />{" "}
        <Link to="/register">
          <FormattedMessage id="nav.register" />
        </Link>
      </p>
    </section>
  );
}
