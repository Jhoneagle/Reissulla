import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * WX-9 / WX-10 air quality + pollen chip. The MSW dev fixture surfaces
 * a clear Helsinki AQ payload with 2.1 grains of birch pollen, which is
 * below the 5 grains/m³ "elevated" threshold — so the dev fixture
 * happens to never surface the pollen sub-line. To pin both the
 * present-state (chip with bucket label + pollen sub-line) and the
 * empty-state (no chip when airQuality is null) we stub the snapshot
 * endpoint browser-side.
 */

function snapshotBase() {
  return {
    data: {
      current: {
        time: new Date(Date.now()).toISOString(),
        temperature: 14,
        apparentTemperature: 13,
        humidity: 65,
        precipitation: 0,
        weatherCode: 2,
        weatherDescription: "Partly cloudy",
        windSpeed: 3,
        windDirection: 200,
        isDay: true,
      },
      forecast: null,
      airQuality: null,
      pollen: null,
      warnings: [],
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

test("AQ chip renders bucket label and elevated pollen sub-line", async ({
  page,
}) => {
  const payload = snapshotBase();
  payload.data.airQuality = {
    europeanAqi: 32,
    pm10: 12.4,
    pm2_5: 6.1,
    nitrogenDioxide: 8.7,
    sulphurDioxide: 1.2,
    ozone: 78.5,
    carbonMonoxide: 210,
    timestamp: payload.data.current.time,
  };
  // Birch above the POLLEN_ELEVATED = 50 grains/m³ cut → "tree" entry surfaces.
  payload.data.pollen = {
    alder: 1.2,
    birch: 84,
    grass: 0.0,
    mugwort: 0.0,
    olive: 0.0,
    ragweed: 0.0,
    timestamp: payload.data.current.time,
  };

  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(payload),
    }),
  );

  await page.goto("/");
  const chip = page.locator(".aq-chip");
  await expect(chip).toBeVisible();
  // AQI 32 falls in the "fair" band per the European AQI mapping.
  await expect(chip).toHaveClass(/aq-chip--fair/);
  await expect(chip.locator(".aq-chip__aqi")).toContainText("32");
  await expect(chip.locator(".aq-chip__bucket")).toContainText(/Fair air/i);
  await expect(chip.locator(".aq-chip__pollen")).toContainText(/tree/i);
});

test("AQ chip is absent when airQuality data is missing", async ({ page }) => {
  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(snapshotBase()),
    }),
  );

  await page.goto("/");
  // Wait for the primary card to mount so we know snapshot data has settled.
  await expect(page.locator(".dashboard-card--primary")).toBeVisible();
  await expect(page.locator(".aq-chip")).toHaveCount(0);
});

test("the AQ chip subtree is axe-core clean", async ({ page }) => {
  const payload = snapshotBase();
  payload.data.airQuality = {
    europeanAqi: 32,
    pm10: 12.4,
    pm2_5: 6.1,
    nitrogenDioxide: 8.7,
    sulphurDioxide: 1.2,
    ozone: 78.5,
    carbonMonoxide: 210,
    timestamp: payload.data.current.time,
  };
  payload.data.pollen = {
    alder: 0.0,
    birch: 0.0,
    grass: 0.0,
    mugwort: 0.0,
    olive: 0.0,
    ragweed: 0.0,
    timestamp: payload.data.current.time,
  };

  await page.route(/\/api\/v1\/weather\/snapshot/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(payload),
    }),
  );

  await page.goto("/");
  await expect(page.locator(".aq-chip")).toBeVisible();
  // Scope axe to the chip. Pre-existing dashboard-card a11y issues
  // are tracked separately and would otherwise mask drift in the chip.
  await expectNoSeriousA11yViolations(page, { include: ".aq-chip" });
});
