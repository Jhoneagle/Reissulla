import { test, expect } from "./fixtures/mock-browser-externals";

/**
 * Chunk 3 acceptance gates for the live-vehicle surface on LineView:
 *
 *   - The page subscribes to `/api/v1/transit/lines/:gtfsId/live` when
 *     `feature.realtimeSse` is on.
 *   - A vehicle dot renders on the map and the SR-accessible VehicleList
 *     row renders in lockstep from the same SSE snapshot.
 *   - The live indicator goes to "live" once the snapshot lands.
 *
 * Every endpoint is stubbed via page.route; map tiles are aborted so the
 * spec stays fully offline.
 */

const GTFS_ID = "HSL:1058";

const LINE_PAYLOAD = {
  data: {
    gtfsId: GTFS_ID,
    shortName: "58",
    longName: "Munkkivuori–Itäkeskus",
    mode: "BUS",
    color: null,
    textColor: null,
    agency: { gtfsId: "HSL:HSL", name: "HSL" },
    region: "HSL",
    patterns: [
      {
        code: "HSL:1058:0:01",
        headsign: "Munkkivuori",
        directionId: 0,
        stops: [
          {
            gtfsId: "HSL:1",
            name: "Itäkeskus",
            lat: 60.21,
            lon: 25.08,
            code: "1",
            platformCode: null,
          },
          {
            gtfsId: "HSL:2",
            name: "Munkkivuori",
            lat: 60.2,
            lon: 24.88,
            code: "2",
            platformCode: null,
          },
        ],
      },
    ],
  },
  cached: false,
};

const VEHICLES_EVENT = {
  vehicles: [
    {
      vehicleId: "22/423",
      routeId: GTFS_ID,
      directionId: "0",
      lat: 60.205,
      lon: 24.98,
      bearing: 270,
      delaySeconds: 60,
      ts: 1_730_000_001_000,
    },
  ],
  freshness: { degraded: false },
};

test("LineView shows a live vehicle dot and a matching list row", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/transit\/lines\/[^/]+\/departures/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], cached: false }),
    }),
  );
  await page.route(/\/api\/v1\/transit\/lines\/[^/]+\/frequency/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], cached: false }),
    }),
  );
  // The single-line lookup — must come after the more specific routes above
  // so /departures and /frequency aren't swallowed by this matcher.
  await page.route(/\/api\/v1\/transit\/lines\/[^/?]+(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(LINE_PAYLOAD),
    }),
  );
  await page.route(/\/api\/v1\/transit\/pinned-lines/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], cached: false }),
    }),
  );
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ feature: { realtimeSse: true } }),
    }),
  );
  // Keep tiles offline.
  await page.route(/tile\.|basemaps\.cartocdn|openstreetmap/, (route) =>
    route.abort(),
  );

  // Fake EventSource that emits one vehicle snapshot once the FE subscribes.
  await page.addInitScript((payload) => {
    interface FakeES {
      url: string;
      onopen: ((e: Event) => void) | null;
      onmessage: ((e: MessageEvent<string>) => void) | null;
      onerror: ((e: Event) => void) | null;
      close: () => void;
    }
    const spy = { hits: 0, lastUrl: null as string | null };
    (window as unknown as { __sseSpy: typeof spy }).__sseSpy = spy;
    function FakeEventSource(this: FakeES, url: string): void {
      spy.hits += 1;
      spy.lastUrl = url;
      this.url = url;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.close = (): void => {};
      setTimeout(() => {
        this.onopen?.(new Event("open"));
        this.onmessage?.(
          new MessageEvent("message", { data: JSON.stringify(payload) }),
        );
      }, 0);
    }
    (window as unknown as { EventSource: unknown }).EventSource =
      FakeEventSource;
  }, VEHICLES_EVENT);

  await page.goto(`/transit/line/${encodeURIComponent(GTFS_ID)}`);

  // Line card renders.
  await expect(page.getByText("58", { exact: true }).first()).toBeVisible();

  // The live indicator turns green once the snapshot lands.
  await expect(page.locator(".live-indicator--live")).toBeVisible({
    timeout: 5000,
  });

  // A vehicle dot is drawn on the map.
  await expect(page.locator(".vehicle-dot").first()).toBeVisible({
    timeout: 5000,
  });

  // The SR list row renders in lockstep, carrying the headsign.
  const row = page.locator(".vehicle-list__row");
  await expect(row).toHaveCount(1);
  await expect(row.first()).toHaveAttribute("aria-label", /Munkkivuori/);

  // The live endpoint was the one subscribed to.
  const sseUrl = await page.evaluate(
    () =>
      (window as unknown as { __sseSpy?: { lastUrl: string } }).__sseSpy
        ?.lastUrl ?? "",
  );
  expect(sseUrl).toContain("/api/v1/transit/lines/");
  expect(sseUrl).toContain("/live");
});
