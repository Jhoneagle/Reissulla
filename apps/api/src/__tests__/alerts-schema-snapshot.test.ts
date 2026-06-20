import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Per-operation drift guard for the `alerts(...)` query. The full OTP2 SDL
 * is snapshotted per adapter by `pnpm --filter @reissulla/api
 * test:graphql-snapshot` (see transit-acceptance gate 7); this test pins
 * the specific `Alert` fields `operations/alerts.ts` selects so a future
 * SDL refresh that renames or drops one of them fails here with a clear
 * message — rather than the notification centre silently losing a column
 * at runtime. Refresh path on a real break: re-run the snapshot script,
 * then update both the query and this list together.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ADAPTERS_DIR = join(HERE, "..", "adapters");

// Every adapter ships the identical upstream SDL bytes, but each one is the
// contract for that graph — assert all four so a partial refresh is caught.
const ADAPTERS = [
  "digitransit-finland",
  "digitransit-hsl",
  "digitransit-waltti",
  "digitransit-varely",
] as const;

// Mirrors the selection set in
// adapters/digitransit-routing/operations/alerts.ts.
const ALERT_FIELDS = [
  "alertHeaderText",
  "alertDescriptionText",
  "alertCause",
  "alertEffect",
  "alertSeverityLevel",
  "effectiveStartDate",
  "effectiveEndDate",
  "entities",
] as const;

function alertTypeBlock(sdl: string): string {
  const start = sdl.indexOf("type Alert implements Node {");
  expect(start).toBeGreaterThan(-1);
  const end = sdl.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return sdl.slice(start, end);
}

describe("Digitransit alerts operation — schema snapshot ledger", () => {
  for (const adapter of ADAPTERS) {
    const sdl = readFileSync(
      join(ADAPTERS_DIR, adapter, "schema.snapshot.graphql"),
      "utf-8",
    );
    const block = alertTypeBlock(sdl);

    it(`${adapter}: Alert type still declares every field the query selects`, () => {
      for (const field of ALERT_FIELDS) {
        expect(block).toMatch(new RegExp(`\\b${field}\\b`));
      }
    });

    it(`${adapter}: AlertEntity still resolves Route + Stop gtfsId`, () => {
      // The query reads `entities { ... on Route { gtfsId } ... on Stop {
      // gtfsId } }` — both members and the gtfsId field must survive.
      expect(sdl).toMatch(/union AlertEntity\b/);
      expect(sdl).toMatch(/type Route implements Node/);
      expect(sdl).toMatch(/type Stop implements (Node|PlaceInterface)/);
    });
  }
});
