import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { FormattedMessage, useIntl } from "react-intl";
import { useAuthStore } from "../stores/auth";
import { ApiError } from "@reissulla/api-client";
import { FormErrorSummary } from "../components/FormErrorSummary";

type ViewState = { kind: "form" } | { kind: "magic-link-sent"; email: string };

export function Register() {
  const signUp = useAuthStore((s) => s.signUp);
  const navigate = useNavigate();
  const intl = useIntl();
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
        // Drop them on Settings with the persona wizard auto-opened so the
        // first thing they do is decide how routes get tailored. They can
        // skip — the wizard's "skip for now" is the same as never running it.
        navigate("/settings?wizard=1");
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

  if (view.kind === "magic-link-sent") {
    return (
      <section aria-labelledby="register-heading" className="auth-page">
        <h2 id="register-heading">
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
    <section aria-labelledby="register-heading" className="auth-page">
      <h2 id="register-heading">
        <FormattedMessage id="register.heading" />
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <FormErrorSummary errors={error ? [error] : []} />
        <div className="form-field">
          <label htmlFor="register-name">
            <FormattedMessage id="register.name" />
          </label>
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
          <label htmlFor="register-email">
            <FormattedMessage id="register.email" />
          </label>
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
          <label htmlFor="register-password">
            <FormattedMessage id="register.password" />
          </label>
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
        <button
          type="submit"
          disabled={submitting}
          className="btn btn--primary"
        >
          <FormattedMessage
            id={submitting ? "register.submitting" : "register.submit"}
          />
        </button>
      </form>
      <p className="auth-switch">
        <FormattedMessage id="register.alreadyHaveAccount" />{" "}
        <Link to="/login">
          <FormattedMessage id="nav.logIn" />
        </Link>
      </p>
    </section>
  );
}
