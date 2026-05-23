import { createTransport as createNodemailerTransport } from "nodemailer";
import { config } from "../config.js";

/**
 * Pluggable email delivery for transactional messages. Today only magic-link
 * sign-in uses this; later phases (account-deletion confirmation, share-link
 * notifications) plug in here too without changing the contract.
 *
 * Three transports:
 *
 * - `smtp`: production. Uses nodemailer against an SMTP relay (Brevo's free
 *   300/day tier is the documented default — the relay choice is config,
 *   not code).
 * - `console`: development. Logs the message instead of sending so dev
 *   doesn't need SMTP credentials and links can be copied out of the API
 *   log directly.
 * - `null`: tests. Silently records sends without delivering.
 *
 * Selection precedence:
 *   1. `EMAIL_TRANSPORT` env var (`smtp` | `console` | `null`).
 *   2. NODE_ENV === "test" → null.
 *   3. NODE_ENV === "production" → smtp.
 *   4. Otherwise → console (dev default).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type EmailTransportName = "smtp" | "console" | "null";

export interface EmailTransport {
  readonly name: EmailTransportName;
  send(msg: EmailMessage): Promise<void>;
}

export interface SmtpTransportOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export function createSmtpTransport(
  opts: SmtpTransportOptions,
): EmailTransport {
  const transporter = createNodemailerTransport({
    host: opts.host,
    port: opts.port,
    // Plain SMTP on 587 with STARTTLS is the default Brevo expects. 465
    // forces TLS-from-start; anything else (e.g. 25) falls back to no auth.
    secure: opts.port === 465,
    auth: { user: opts.user, pass: opts.password },
  });

  return {
    name: "smtp",
    async send(msg) {
      await transporter.sendMail({
        from: opts.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
      });
    },
  };
}

export interface ConsoleTransportOptions {
  from: string;
  // Optional injected logger so consumers can route through Fastify's pino
  // rather than `console.log`. Falls back to console when not provided.
  log?: (info: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => void;
}

export function createConsoleTransport(
  opts: ConsoleTransportOptions,
): EmailTransport {
  return {
    name: "console",
    async send(msg) {
      const entry = {
        from: opts.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
      };
      if (opts.log) {
        opts.log(entry);
      } else {
        console.log("[email:console]", entry);
      }
    },
  };
}

/**
 * Null transport: silently records sends. Used in tests so flows that
 * trigger an email don't blow up looking for a real relay. Records are
 * inspectable for assertions.
 */
export interface NullTransport extends EmailTransport {
  readonly name: "null";
  readonly sent: EmailMessage[];
  reset(): void;
}

export function createNullTransport(): NullTransport {
  const sent: EmailMessage[] = [];
  return {
    name: "null",
    sent,
    reset() {
      sent.length = 0;
    },
    async send(msg) {
      sent.push(msg);
    },
  };
}

export interface EmailConfig {
  transport: EmailTransportName;
  from: string;
  smtp?: { host: string; port: number; user: string; password: string };
}

export function createEmailTransport(cfg: EmailConfig): EmailTransport {
  if (cfg.transport === "null") return createNullTransport();
  if (cfg.transport === "console") {
    return createConsoleTransport({ from: cfg.from });
  }

  if (!cfg.smtp) {
    throw new Error(
      "EMAIL_TRANSPORT=smtp requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS",
    );
  }
  return createSmtpTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    user: cfg.smtp.user,
    password: cfg.smtp.password,
    from: cfg.from,
  });
}

function resolveTransportName(): EmailTransportName {
  const raw = process.env.EMAIL_TRANSPORT;
  if (raw === "smtp" || raw === "console" || raw === "null") return raw;
  if (raw !== undefined && raw !== "") {
    throw new Error(
      `Invalid EMAIL_TRANSPORT="${raw}" — expected "smtp" | "console" | "null"`,
    );
  }
  if (config.nodeEnv === "test") return "null";
  if (config.nodeEnv === "production") return "smtp";
  return "console";
}

function loadEmailConfig(): EmailConfig {
  const transport = resolveTransportName();
  const from = process.env.EMAIL_FROM ?? "Reissulla <no-reply@reissulla.fi>";

  if (transport === "smtp") {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASS;
    if (!host || !portRaw || !user || !password) {
      throw new Error(
        "EMAIL_TRANSPORT=smtp requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS",
      );
    }
    const port = Number(portRaw);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(
        `Invalid SMTP_PORT="${portRaw}" — expected a positive integer`,
      );
    }
    return { transport, from, smtp: { host, port, user, password } };
  }

  return { transport, from };
}

let memoized: EmailTransport | undefined;

/** Lazy-initialised module singleton. */
export function getEmailTransport(): EmailTransport {
  if (!memoized) {
    memoized = createEmailTransport(loadEmailConfig());
  }
  return memoized;
}

/** Test-only escape hatch — lets a test swap the transport. */
export function setEmailTransportForTesting(
  transport: EmailTransport | undefined,
): void {
  memoized = transport;
}
