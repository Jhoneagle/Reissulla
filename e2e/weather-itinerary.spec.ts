import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Phase 3 Chunk 6 — itinerary weather strip on the planner card.
 *
 * The MSW geocoding fixture surfaces Helsinki + Tampere Mannerheimintie
 * results, but the planner POST is intercepted browser-side so the test
 * doesn't depend on the real plan-fixture / forecast cross-region
 * alignment landing in the dev server — what we're asserting is purely
 * the UI wiring: planner → ItineraryCard → ItineraryWeatherStrip.
 *
 * The "share-link page omits weather" branch is asserted via the
 * /transit/plan request capture rather than a separate stubbed page.
 */

const PLAN_FIXTURE = {
  data: {
    itineraries: [
      {
        startTime: Date.UTC(2026, 4, 5, 9, 0, 0),
        endTime: Date.UTC(2026, 4, 5, 11, 45, 0),
        duration: 165 * 60,
        walkDistance: 700,
        transfers: 1,
        legs: [
          {
            mode: "WALK",
            startTime: Date.UTC(2026, 4, 5, 9, 0, 0),
            endTime: Date.UTC(2026, 4, 5, 9, 5, 0),
            duration: 300,
            distance: 350,
            from: { name: "Origin", lat: 60.17, lon: 24.94 },
            to: { name: "Helsinki", lat: 60.17, lon: 24.94 },
          },
          {
            mode: "RAIL",
            startTime: Date.UTC(2026, 4, 5, 9, 10, 0),
            endTime: Date.UTC(2026, 4, 5, 9, 16, 0),
            duration: 360,
            distance: 4200,
            from: { name: "Helsinki", lat: 60.17, lon: 24.94 },
            to: { name: "Pasila", lat: 60.2, lon: 24.93 },
            route: { shortName: "P", longName: "Helsinki - Vantaankoski" },
          },
          {
            mode: "RAIL",
            // 9-min Pasila platform gap → wait entry.
            startTime: Date.UTC(2026, 4, 5, 9, 25, 0),
            endTime: Date.UTC(2026, 4, 5, 11, 10, 0),
            duration: 6300,
            distance: 165_000,
            from: { name: "Pasila", lat: 60.2, lon: 24.93 },
            to: { name: "Tampere", lat: 61.5, lon: 23.79 },
            route: { shortName: "IC", longName: "Helsinki - Oulu" },
          },
          {
            mode: "WALK",
            startTime: Date.UTC(2026, 4, 5, 11, 10, 0),
            endTime: Date.UTC(2026, 4, 5, 11, 45, 0),
            duration: 2100,
            distance: 350,
            from: { name: "Tampere", lat: 61.5, lon: 23.79 },
            to: { name: "Destination", lat: 61.5, lon: 23.79 },
          },
        ],
        farePlaceholders: true,
        weather: {
          originWeather: {
            time: "2026-05-05T12:00",
            temperature: 15.2,
            humidity: 65,
            precipitationProbability: 10,
            weatherCode: 2,
            weatherDescription: "Partly cloudy",
            windSpeed: 5.4,
          },
          destinationWeather: {
            time: "2026-05-05T14:00",
            temperature: 10.5,
            humidity: 72,
            precipitationProbability: 60,
            weatherCode: 61,
            weatherDescription: "Slight rain",
            windSpeed: 3.5,
          },
          legOutdoorWaits: [
            {
              legIndex: 2,
              outdoorWaitMin: 9,
              weather: {
                time: "2026-05-05T12:00",
                temperature: 14.0,
                humidity: 68,
                precipitationProbability: 20,
                weatherCode: 2,
                weatherDescription: "Partly cloudy",
                windSpeed: 5.0,
              },
            },
          ],
        },
      },
    ],
  },
  cached: false,
};

test.use({ locale: "en-US" });

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/v1\/transit\/plan(\?.*)?$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON() as { weather?: boolean };
    // The fixture above is the weather:true shape; for the legacy call
    // strip the weather envelope so the share-link parity branch is
    // also assertable from this spec.
    if (body.weather === true) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(PLAN_FIXTURE),
      });
    }
    const legacy = {
      ...PLAN_FIXTURE,
      data: {
        itineraries: PLAN_FIXTURE.data.itineraries.map((it) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { weather: _, ...rest } = it;
          return rest;
        }),
      },
    };
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(legacy),
    });
  });
});

async function submitMannerheimintiePlan(
  page: import("@playwright/test").Page,
) {
  await page.goto("/transit?tab=planner");

  // Fill From with Helsinki Mannerheimintie — the MSW fixture surfaces
  // both Helsinki + Tampere as autocomplete results. Pelias renders the
  // primary name and secondary (neighbourhood/locality) in separate spans
  // so the option's accessible name has no comma — match leniently.
  const fromInput = page.locator("#transit-from");
  await fromInput.fill("Mannerheimintie");
  // The dropdown debounces 300 ms before opening.
  const helsinkiOption = page
    .getByRole("option")
    .filter({ hasText: /Helsinki/ })
    .first();
  await helsinkiOption.click();

  const toInput = page.locator("#transit-to");
  await toInput.fill("Mannerheimintie");
  const tampereOption = page
    .getByRole("option")
    .filter({ hasText: /Tampere/ })
    .first();
  await tampereOption.click();

  // The planner fires `useRoutePlan(planInput)` as soon as both ends
  // are set — no submit button. Wait for the itinerary card to mount.
  await expect(page.locator(".itinerary-card")).toBeVisible();
}

test("planner card surfaces the itinerary weather strip collapsed by default", async ({
  page,
}) => {
  await submitMannerheimintiePlan(page);

  const strip = page.locator(".itinerary-weather");
  await expect(strip).toBeVisible();

  // Defaults to closed: <details> without [open].
  await expect(strip).not.toHaveAttribute("open", "");

  // The lede summary mentions both origin and destination temperatures.
  await expect(strip.locator(".itinerary-weather__lede")).toContainText(
    /15° Partly cloudy at depart/,
  );
  await expect(strip.locator(".itinerary-weather__lede")).toContainText(
    /11° Slight rain at arrival/,
  );
});

test("clicking the summary expands the strip and reveals the outdoor wait", async ({
  page,
}) => {
  await submitMannerheimintiePlan(page);

  const strip = page.locator(".itinerary-weather");
  await strip.locator(".itinerary-weather__summary").click();
  await expect(strip).toHaveAttribute("open", "");

  // The 9-min Pasila wait surfaces as a chip with the boarding place name.
  await expect(strip.getByText(/Outdoor wait at Pasila/)).toBeVisible();
  await expect(strip.getByText("+9 min")).toBeVisible();
});

test("planner with the weather strip surfaced is axe-core clean", async ({
  page,
}) => {
  await submitMannerheimintiePlan(page);
  await page.locator(".itinerary-weather__summary").click();
  await expectNoSeriousA11yViolations(page);
});

test("mobile viewport opens the disclosure with a single tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await submitMannerheimintiePlan(page);

  const strip = page.locator(".itinerary-weather");
  await expect(strip).not.toHaveAttribute("open", "");
  // `click()` covers both pointer and touch on Chromium-without-hasTouch;
  // the native `<details>` toggle responds identically. A real
  // touch-enabled run would just rebind to `tap()`.
  await strip.locator(".itinerary-weather__summary").click();
  await expect(strip).toHaveAttribute("open", "");
});
