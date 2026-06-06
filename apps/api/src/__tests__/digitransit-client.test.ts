import { describe, it, expect } from "vitest";
import { createGraphQLClient } from "../adapters/digitransit-routing/client.js";
import { DigitransitError } from "../adapters/digitransit-routing/errors.js";
import type { AdapterContext } from "../adapters/types.js";
import { SYNTHETIC_ROUTING_BASE } from "../../test/msw/handlers/digitransit-routing.js";

function ctx(): AdapterContext {
  return { signal: new AbortController().signal, locale: "fi" };
}

/**
 * Transport-level tests for the GraphQL client. Each scenario is wired to
 * a distinct synthetic URL path (defined in the MSW handler) so the
 * handler set stays closed and tests don't mutate it.
 */
describe("digitransit GraphQL client", () => {
  it("returns parsed data on success", async () => {
    const client = createGraphQLClient(
      "digitransit-finland",
      `${SYNTHETIC_ROUTING_BASE}/ok`,
    );
    const result = await client.graphql<{ ok: boolean }>("{ q }", {}, ctx());

    expect(result).toEqual({ ok: true });
  });

  it("throws DigitransitError('http') on non-2xx responses", async () => {
    const client = createGraphQLClient(
      "digitransit-finland",
      `${SYNTHETIC_ROUTING_BASE}/http-error`,
    );
    await expect(client.graphql("{ q }", {}, ctx())).rejects.toMatchObject({
      name: "DigitransitError",
      source: "digitransit-finland",
      cause: "http",
    });
  });

  it("throws DigitransitError('graphql') when the response carries errors", async () => {
    const client = createGraphQLClient(
      "digitransit-hsl",
      `${SYNTHETIC_ROUTING_BASE}/graphql-error`,
    );
    await expect(client.graphql("{ q }", {}, ctx())).rejects.toMatchObject({
      name: "DigitransitError",
      source: "digitransit-hsl",
      cause: "graphql",
    });
  });

  it("throws DigitransitError('network') on fetch rejection", async () => {
    const client = createGraphQLClient(
      "digitransit-finland",
      `${SYNTHETIC_ROUTING_BASE}/network-error`,
    );
    const err = await client
      .graphql("{ q }", {}, ctx())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DigitransitError);
    expect((err as DigitransitError).cause).toBe("network");
  });

  it("aborts via the caller's signal when it fires before the response", async () => {
    const controller = new AbortController();
    const client = createGraphQLClient(
      "digitransit-finland",
      `${SYNTHETIC_ROUTING_BASE}/abort`,
    );
    const promise = client.graphql("{ q }", {}, { signal: controller.signal });
    // Microtask delay so the fetch goes out, then abort.
    queueMicrotask(() => controller.abort());

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DigitransitError);
  });
});
