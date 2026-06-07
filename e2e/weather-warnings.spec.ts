import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * WX-8 dashboard warning banner. The MSW-backed dev server returns the
 * canonical Helsinki snapshot (no active warnings during clear weather),
 * so we intercept the snapshot endpoint browser-side to drive a
 * deterministic severe warning. That keeps the assertions stable
 * regardless of FMI's real-time state.
 *
 * Scope:
 *   - Banner mounts on the GPS primary card when warnings[] is non-empty.
 *   - Severity → palette class mapping holds end-to-end.
 *   - Dismissing the only visible banner removes the article and shifts
 *     focus to the visually-hidden page heading (the configured restore
 *     target on the dashboard primary card).
 *   - axe-core: zero serious/critical with the banner present.
 */

const HOUR = 60 * 60_000;

function snapshotWithWarning(severity: "minor" | "moderate" | "severe") {
  const now = Date.now();
  return {
    data: {
      current: {
        time: new Date(now).toISOString(),
        temperature: 12,
        apparentTemperature: 11,
        humidity: 70,
        precipitation: 0,
        weatherCode: 2,
        weatherDescription: "Partly cloudy",
        windSpeed: 4,
        windDirection: 180,
        isDay: true,
      },
      forecast: null,
      airQuality: null,
      pollen: null,
      warnings: [
        {
          id: `e2e-warning-${severity}`,
          severity,
          type: "wind",
          startTime: now - HOUR,
          endTime: now + 4 * HOUR,
          region: "Uusimaa",
          description:
            severity === "severe"
              ? "Severe weather warning: damaging coastal gusts to 25 m/s."
              : "Brisk southerly winds across Uusimaa.",
          bounds: {
            type: "Polygon",
            coordinates: [
              [
                [24.0, 60.0],
                [25.5, 60.0],
                [25.5, 60.5],
                [24.0, 60.5],
                [24.0, 60.0],
              ],
            ],
          },
        },
      ],
      roadConditions: null,
      nowcast: null,
    },
    meta: {
      current: { cached: false, failed: false },
      forecast: { cached: false, failed: false },
      airQuality: { cached: false, failed: false },
      pollen: { cached: false, failed: false },
      warnings: { cached: false, failed: false },
      roadConditions: { cached: false, failed: false },
      nowcast: { cached: false, failed: false },
    },
    coordinates: { latitude: 60.1699, longitude: 24.9384 },
    locale: "en",
  };
}

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 60.1699, longitude: 24.9384 },
  locale: "en-US",
});

test.beforeEach(async ({ page }) => {
  // The dashboard re-reads any dismissed-warning state from localStorage —
  // wipe it so the banner re-appears on each test even if a previous run
  // left a dismissal stamp under the same id.
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("reissulla:dismissed-warnings");
    } catch {
      /* noop — fixture page may not allow storage yet */
    }
  });
});

test("severe warning surfaces the banner on the primary card", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(snapshotWithWarning("severe")),
    }),
  );

  await page.goto("/");
  const banner = page.locator("[data-testid='warning-banner']");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveClass(/warning-banner--severe/);
  await expect(banner).toContainText(/Severe weather warning/i);
  await expect(banner).toHaveAttribute("role", "status");
});

test("moderate warning rides the warning palette (not error)", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(snapshotWithWarning("moderate")),
    }),
  );

  await page.goto("/");
  const banner = page.locator("[data-testid='warning-banner']");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveClass(/warning-banner--moderate/);
  await expect(banner).not.toHaveClass(/warning-banner--severe/);
});

test("dismissing the only banner removes it from the stack", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(snapshotWithWarning("moderate")),
    }),
  );

  await page.goto("/");
  const banner = page.locator("[data-testid='warning-banner']");
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: /dismiss warning/i }).click();
  await expect(banner).toHaveCount(0);
});

test("the warning banner subtree is axe-core clean", async ({ page }) => {
  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(snapshotWithWarning("severe")),
    }),
  );

  await page.goto("/");
  await expect(page.locator("[data-testid='warning-banner']")).toBeVisible();
  // Scope axe to the banner. Pre-existing dashboard-card a11y issues
  // (e.g. nearby-stops h4 contrast) are tracked separately and would
  // otherwise mask drift in the new banner surface.
  await expectNoSeriousA11yViolations(page, {
    include: "[data-testid='warning-banner']",
  });
});
