import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGraphQLClient } from "../adapters/digitransit-routing/client.js";
import { DigitransitError } from "../adapters/digitransit-routing/errors.js";
import type { AdapterContext } from "../adapters/types.js";

function ctx(): AdapterContext {
  return { signal: new AbortController().signal };
}

describe("digitransit GraphQL client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed data on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );

    const client = createGraphQLClient("digitransit-finland", "https://example/");
    const result = await client.graphql<{ ok: boolean }>("{ q }", {}, ctx());

    expect(result).toEqual({ ok: true });
  });

  it("throws DigitransitError('http') on non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("oops", { status: 503, statusText: "Service Unavailable" }),
    );

    const client = createGraphQLClient("digitransit-finland", "https://example/");
    await expect(client.graphql("{ q }", {}, ctx())).rejects.toMatchObject({
      name: "DigitransitError",
      source: "digitransit-finland",
      cause: "http",
    });
  });

  it("throws DigitransitError('graphql') when the response carries errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: "Bad query" }],
        }),
        { status: 200 },
      ),
    );

    const client = createGraphQLClient("digitransit-hsl", "https://example/");
    await expect(client.graphql("{ q }", {}, ctx())).rejects.toMatchObject({
      name: "DigitransitError",
      source: "digitransit-hsl",
      cause: "graphql",
    });
  });

  it("throws DigitransitError('network') on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("connect ECONNREFUSED"),
    );

    const client = createGraphQLClient("digitransit-finland", "https://example/");
    const err = await client
      .graphql("{ q }", {}, ctx())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DigitransitError);
    expect((err as DigitransitError).cause).toBe("network");
  });

  it("aborts via the caller's signal when it fires before the response", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const client = createGraphQLClient("digitransit-finland", "https://example/");
    const promise = client.graphql("{ q }", {}, { signal: controller.signal });
    controller.abort();

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DigitransitError);
  });
});
