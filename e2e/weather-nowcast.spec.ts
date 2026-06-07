import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Dashboard `RainNowcast` live region. The MSW-backed API would emit a
 * `no-rain` nowcast for the Helsinki Open-Meteo fixture (clear-sky code,
 * low precip probs) which is boring to assert against; this spec
 * intercepts the nowcast endpoint at the browser level and serves a
 * deterministic `rain-incoming` payload so the live-region text + the
 * data-state attribute are both checkable.
 *
 * Throttle behaviour is unit-tested in
 * `apps/web/src/components/weather/__tests__/RainNowcast.test.tsx`; this
 * spec only covers wiring: GPS card → LocationCard → RainNowcast →
 * polite `<p role="status">`.
 */

const NOWCAST_FIXTURE = {
  data: {
    state: "rain-incoming" as const,
    flavor: "rain" as const,
    minutesUntilStart: 30,
    textFi: "Sade alkaa noin 30 minuutin kuluttua.",
    textEn: "Rain expected in about 30 minutes.",
  },
  meta: { cached: false, locale: "en" as const },
};

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 60.1699, longitude: 24.9384 },
  locale: "en-US",
});

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/v1\/weather\/nowcast/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(NOWCAST_FIXTURE),
    }),
  );
});

test("dashboard primary card surfaces the polite rain-nowcast live region", async ({
  page,
}) => {
  await page.goto("/");

  // The dashboard primary card is the GPS-driven LocationCard; wait for
  // its weather-depth block to mount before reading the live region.
  await expect(page.locator(".dashboard-card--primary")).toBeVisible();

  const live = page.locator('.rain-nowcast__text[role="status"]');
  await expect(live).toContainText("Rain expected in about 30 minutes.");

  // The component decorates its container with the state + flavor so the
  // snow palette / colour ramp can fork without touching markup.
  const section = page.locator(".rain-nowcast");
  await expect(section).toHaveAttribute("data-state", "rain-incoming");
  await expect(section).toHaveClass(/rain-nowcast--rain/);
});

test("dashboard with the rain nowcast surfaced is axe-core clean (critical/serious)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator('.rain-nowcast__text[role="status"]'),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
