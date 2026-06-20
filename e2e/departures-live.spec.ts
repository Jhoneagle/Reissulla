import { test, expect } from "./fixtures/mock-browser-externals";

/**
 * Chunk 2 acceptance gates for the live-departures surface:
 *
 *   - Live indicator pill goes to "live" within 2 s of mount when the
 *     SSE channel emits an event.
 *   - The DepartureBoard subscribes to `/api/v1/transit/stops/:id/live`
 *     when `feature.realtimeSse` is true and the deep-link is a single
 *     non-station stop.
 *   - When SSE is off (flag false), the indicator shows the polling
 *     state and the FE never attempts the live endpoint.
 *
 * Every endpoint touched is stubbed via page.route — the spec must not
 * leak through to the live API even when the dev server is running.
 */

const STOP_ID = "HSL:1040601";

const BASE_DEPARTURE = {
  routeShortName: "550",
  routeLongName: "Itäkeskus(M)–Westendinasema",
  routeGtfsId: "HSL:1059",
  headsign: "Westendinasema",
  scheduledArrival: 36000,
  realtimeArrival: 36000,
  arrivalDelay: 0,
  scheduledDeparture: 36000,
  realtimeDeparture: 36000,
  departureDelay: 0,
  realtime: true,
  serviceDay: 1_730_000_000,
  vehicleMode: "BUS",
  stopId: STOP_ID,
  platformCode: null,
  tripId: "HSL:trip-a",
  canBoard: true,
  canAlight: true,
};

const REST_PAYLOAD = {
  data: {
    stopName: "Kamppi (M)",
    departures: [BASE_DEPARTURE],
    serviceDay: { iso: "2025-10-23", unix: 1_730_000_000 },
  },
  cached: false,
};

test("live indicator turns green when an SSE event lands and stays polling otherwise", async ({
  page,
}) => {
  // Stub the REST departures + first-last endpoints so the page renders
  // without reaching the real API.
  await page.route(/\/api\/v1\/transit\/departures(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(REST_PAYLOAD),
    }),
  );
  await page.route(/\/api\/v1\/transit\/departures\/first-last/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: null, cached: false }),
    }),
  );
  // Stop list + line search responses the SearchStop and similar might hit.
  await page.route(/\/api\/v1\/transit\/(stops|lines)\b/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], cached: false }),
    }),
  );
  // Feature flag — live SSE on.
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ feature: { realtimeSse: true } }),
    }),
  );

  // Playwright's `route.fulfill` can't keep an SSE response open long
  // enough for the browser to fire `onmessage` cleanly — the body lands
  // but the simultaneous EOF often gets parsed as an error. Swap the
  // global EventSource with a hand-rolled fake instead: it tells us
  // exactly when the FE subscribed, and lets us emit one event under
  // test control before reporting "open".
  const liveDeparture = { ...BASE_DEPARTURE, departureDelay: 120 };
  await page.addInitScript(
    (payload) => {
      interface FakeES {
        url: string;
        onopen: ((e: Event) => void) | null;
        onmessage: ((e: MessageEvent<string>) => void) | null;
        onerror: ((e: Event) => void) | null;
        close: () => void;
      }
      const ctorSpy = {
        hits: 0,
        lastUrl: null as string | null,
      };
      (window as unknown as { __sseSpy: typeof ctorSpy }).__sseSpy = ctorSpy;

      // The page now opens two streams: the departures `/live` channel under
      // test and the alerts `/api/v1/alerts/live` channel. Only spy on /
      // emit the departure payload to the departures stream; hand the alerts
      // stream a valid (empty) Alert[] so its hook stays happy.
      const isAlerts = (url: string): boolean => url.includes("/alerts/");
      function FakeEventSource(this: FakeES, url: string): void {
        this.url = url;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.close = (): void => {};
        if (!isAlerts(url)) {
          ctorSpy.hits += 1;
          ctorSpy.lastUrl = url;
        }
        // Open + emit one message on the next tick so React useEffect has
        // wired the handlers before we fire.
        setTimeout(() => {
          this.onopen?.(new Event("open"));
          this.onmessage?.(
            new MessageEvent("message", {
              data: JSON.stringify(isAlerts(url) ? [] : payload),
            }),
          );
        }, 0);
      }

      (window as unknown as { EventSource: unknown }).EventSource =
        FakeEventSource;
    },
    [liveDeparture],
  );

  await page.goto(`/transit?stopId=${encodeURIComponent(STOP_ID)}`);

  // The stop's heading lands first via the REST snapshot.
  await expect(
    page.getByRole("heading", { level: 3, name: "Kamppi (M)" }),
  ).toBeVisible();

  // The live indicator transitions to "live" once the SSE event arrives.
  await expect(page.locator(".live-indicator--live")).toBeVisible({
    timeout: 5000,
  });

  // The SSE endpoint was actually subscribed to — gate 5.2 done-when.
  const sseHits = await page.evaluate(
    () =>
      (window as unknown as { __sseSpy?: { hits: number; lastUrl: string } })
        .__sseSpy?.hits ?? 0,
  );
  const sseUrl = await page.evaluate(
    () =>
      (window as unknown as { __sseSpy?: { hits: number; lastUrl: string } })
        .__sseSpy?.lastUrl ?? "",
  );
  expect(sseHits).toBeGreaterThanOrEqual(1);
  expect(sseUrl).toContain(`/api/v1/transit/stops/`);
  expect(sseUrl).toContain(`/live`);

  // Refresh-ticker cog is visible and the disclosure can be opened.
  const cog = page.getByLabel(/Refresh settings|Päivitysasetukset/);
  await expect(cog).toBeVisible();
  await cog.click();
  await expect(
    page.getByRole("radio", { name: /Live \(server-sent\)|Reaaliaika/ }),
  ).toBeChecked();
});

test("live indicator stays in the polling state when the SSE flag is off", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/transit\/departures(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(REST_PAYLOAD),
    }),
  );
  await page.route(/\/api\/v1\/transit\/departures\/first-last/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: null, cached: false }),
    }),
  );
  await page.route(/\/api\/v1\/transit\/(stops|lines)\b/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], cached: false }),
    }),
  );
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ feature: { realtimeSse: false } }),
    }),
  );

  // Hard assertion: the FE must NOT construct an EventSource when the
  // flag is off. The init-script captures every construction attempt so
  // we can assert `hits === 0` after the page settles.
  await page.addInitScript(() => {
    interface FakeES {
      url: string;
      onopen: ((e: Event) => void) | null;
      onmessage: ((e: MessageEvent<string>) => void) | null;
      onerror: ((e: Event) => void) | null;
      close: () => void;
    }
    const ctorSpy = { hits: 0 };
    (window as unknown as { __sseSpy: typeof ctorSpy }).__sseSpy = ctorSpy;
    function FakeEventSource(this: FakeES, url: string): void {
      ctorSpy.hits += 1;
      this.url = url;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.close = (): void => {};
    }
    (window as unknown as { EventSource: unknown }).EventSource =
      FakeEventSource;
  });

  await page.goto(`/transit?stopId=${encodeURIComponent(STOP_ID)}`);

  await expect(
    page.getByRole("heading", { level: 3, name: "Kamppi (M)" }),
  ).toBeVisible();

  // Polling pill is rendered, not the live one.
  await expect(page.locator(".live-indicator--polling")).toBeVisible();
  await expect(page.locator(".live-indicator--live")).not.toBeVisible();

  // Give the page a beat in case the hook had a deferred attempt.
  await page.waitForTimeout(300);
  const sseHits = await page.evaluate(
    () =>
      (window as unknown as { __sseSpy?: { hits: number } }).__sseSpy?.hits ??
      0,
  );
  expect(sseHits).toBe(0);
});
