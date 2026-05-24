import { describe, it, expect } from "vitest";
import {
  createConsoleTransport,
  createEmailTransport,
  createNullTransport,
} from "../email/transport.js";

describe("createNullTransport", () => {
  it("records sent messages without throwing", async () => {
    const transport = createNullTransport();
    await transport.send({ to: "a@b.test", subject: "Hi", text: "body" });
    await transport.send({ to: "c@d.test", subject: "Hello", text: "more" });
    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[0]).toEqual({
      to: "a@b.test",
      subject: "Hi",
      text: "body",
    });
  });

  it("reset() empties the recorded messages", async () => {
    const transport = createNullTransport();
    await transport.send({ to: "a@b.test", subject: "Hi", text: "body" });
    transport.reset();
    expect(transport.sent).toHaveLength(0);
  });

  it("identifies itself as 'null'", () => {
    expect(createNullTransport().name).toBe("null");
  });
});

describe("createConsoleTransport", () => {
  it("routes messages through the injected logger when present", async () => {
    const calls: unknown[] = [];
    const transport = createConsoleTransport({
      from: "Reissulla <no-reply@reissulla.fi>",
      log: (info) => calls.push(info),
    });
    await transport.send({ to: "a@b.test", subject: "Hi", text: "body" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      from: "Reissulla <no-reply@reissulla.fi>",
      to: "a@b.test",
      subject: "Hi",
      text: "body",
    });
  });

  it("identifies itself as 'console'", () => {
    expect(createConsoleTransport({ from: "x" }).name).toBe("console");
  });
});

describe("createEmailTransport", () => {
  it("returns a null transport for the 'null' config", () => {
    const t = createEmailTransport({ transport: "null", from: "x" });
    expect(t.name).toBe("null");
  });

  it("returns a console transport for the 'console' config", () => {
    const t = createEmailTransport({ transport: "console", from: "x" });
    expect(t.name).toBe("console");
  });

  it("returns an smtp transport when SMTP options are present", () => {
    const t = createEmailTransport({
      transport: "smtp",
      from: "x",
      smtp: { host: "smtp.test", port: 587, user: "u", password: "p" },
    });
    expect(t.name).toBe("smtp");
  });

  it("throws when smtp transport is selected without smtp options", () => {
    expect(() =>
      createEmailTransport({ transport: "smtp", from: "x" }),
    ).toThrow(/SMTP_HOST/);
  });
});
