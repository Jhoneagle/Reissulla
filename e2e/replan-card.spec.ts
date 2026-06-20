import { expect, test } from "./fixtures/mock-browser-externals";

/**
 * Disruption-driven re-plan surface (LIVE-6). The planner POST is stubbed to
 * return a `replanSuggestion`, geocoding is stubbed so origin/destination can
 * be picked deterministically, and `/api/v1/alerts` returns the triggering
 * alert so the banner resolves its headline. Feature flags are SSE-off so the
 * alert hook takes the REST-poll path.
 *
 * The re-plan decision logic + wire contract are covered by the API unit and
 * integration suites; this spec proves the FE renders the banner, reveals the
 * alternative, and adopts it.
 */

const ALERT_ID = "HSL:alert:replan-e2e";
const DISRUPTED_ROUTE = "HSL:1004";

function flagsOff() {
  return {
    contentType: "application/json",
    body: JSON.stringify({ feature: { realtimeSse: false } }),
  };
}

const ORIGIN = {
  placeId: "o1",
  name: "Helsinki",
  displayName: "Helsinki, Finland",
  latitude: 60.17,
  longitude: 24.94,
  type: "city",
  importance: 1,
};

const DESTINATION = {
  placeId: "d1",
  name: "Tampere",
  displayName: "Tampere, Finland",
  latitude: 61.5,
  longitude: 23.79,
  type: "city",
  importance: 1,
};

function leg(routeShortName: string, gtfsId: string) {
  return {
    mode: "BUS",
    startTime: 1_700_000_060_000,
    endTime: 1_700_000_900_000,
    duration: 840,
    distance: 5000,
    from: { name: "Helsinki", lat: 60.17, lon: 24.94 },
    to: { name: "Tampere", lat: 61.5, lon: 23.79 },
    route: { gtfsId, shortName: routeShortName, longName: "Test line" },
  };
}

function itinerary(routeShortName: string, gtfsId: string) {
  return {
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_900_000,
    duration: 900,
    walkDistance: 100,
    transfers: 0,
    legs: [leg(routeShortName, gtfsId)],
  };
}

const PLAN_BODY = {
  data: {
    itineraries: [itinerary("4", DISRUPTED_ROUTE)],
    replanSuggestion: {
      triggered: true,
      reason: { alertIds: [ALERT_ID], effect: ["NO_SERVICE"] },
      alternative: { itineraries: [itinerary("9", "HSL:1009")] },
    },
  },
  cached: false,
};

const ALERT = {
  id: ALERT_ID,
  source: "digitransit",
  severity: "severe",
  cause: "TECHNICAL",
  effect: "NO_SERVICE",
  startTime: 1_600_000_000_000,
  endTime: null,
  scope: { kind: "route", gtfsId: DISRUPTED_ROUTE },
  headline: { fi: "Linja 4 ei liikennöi", en: "Route 4 is not running" },
  description: {
    fi: "Käytä vaihtoehtoista reittiä.",
    en: "Use an alternative.",
  },
};

async function stubExternals(page: import("@playwright/test").Page) {
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill(flagsOff()),
  );
  await page.route(/\/api\/v1\/alerts(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [ALERT], cached: false }),
    }),
  );
  await page.route(/\/api\/v1\/geocoding\/search/, (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    const result = /tamp/i.test(q) ? DESTINATION : ORIGIN;
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [result] }),
    });
  });
  await page.route(
    (url) => url.pathname.endsWith("/api/v1/transit/plan"),
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(PLAN_BODY),
      }),
  );
}

async function pickLocation(
  page: import("@playwright/test").Page,
  inputId: string,
  text: string,
) {
  await page.fill(`#${inputId}`, text);
  await page.locator(`#${inputId}-listbox [role='option']`).first().click();
}

test("planner surfaces a re-plan banner and adopts the alternative", async ({
  page,
}) => {
  await stubExternals(page);
  await page.goto("/transit?tab=planner");

  await pickLocation(page, "transit-from", "Helsinki");
  await pickLocation(page, "transit-to", "Tampere");

  // The disruption banner appears, carrying the alert headline.
  const banner = page.getByRole("region", {
    name: /Service disruption|Liikennehäiriö/,
  });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/Route 4 is not running|Linja 4/);

  // Reveal the pre-computed alternative.
  await page
    .getByRole("button", { name: /Show alternative|Näytä vaihtoehto/ })
    .click();
  await expect(
    page.getByText(/Suggested alternative|Ehdotettu vaihtoehto/),
  ).toBeVisible();

  // Adopt it — the slot switches to the alternative.
  await page
    .getByRole("button", { name: /Use this alternative|Käytä tätä/ })
    .click();
  await expect(
    page.getByText(/Showing suggested alternative|Näytetään ehdotettu/),
  ).toBeVisible();
});
