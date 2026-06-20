import { expect, test } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Service-alert surfacing on the LineView page. The composed `/api/v1/alerts`
 * set is stubbed via page.route; feature flags are forced SSE-off so the FE
 * takes the REST-poll path (deterministic in E2E). The dashboard DASH-5 and
 * region-status surfaces are auth-gated and covered by component tests.
 */

const LINE_ID = "HSL:1004";

function flagsOff() {
  return {
    contentType: "application/json",
    body: JSON.stringify({ feature: { realtimeSse: false } }),
  };
}

function alertsBody(alerts: unknown[]) {
  return {
    contentType: "application/json",
    body: JSON.stringify({ data: alerts, cached: false }),
  };
}

const ROUTE_ALERT = {
  id: "HSL:alert:e2e-1",
  source: "digitransit",
  severity: "warning",
  cause: "MAINTENANCE",
  effect: "DETOUR",
  startTime: 1_700_000_000_000,
  endTime: null,
  scope: { kind: "route", gtfsId: LINE_ID },
  headline: { fi: "Linja 4 kiertää", en: "Route 4 detour" },
  description: { fi: "Poikkeusreitti käytössä.", en: "Detour in effect." },
};

test("LineView surfaces an active service alert banner", async ({ page }) => {
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill(flagsOff()),
  );
  await page.route(/\/api\/v1\/alerts(?:\?|$)/, (route) =>
    route.fulfill(alertsBody([ROUTE_ALERT])),
  );

  await page.goto(`/transit/line/${encodeURIComponent(LINE_ID)}`);

  const banner = page.locator("[data-testid='alert-banner']");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(
    /Route 4 detour|Detour in effect|Linja 4 kiertää|Poikkeusreitti/,
  );
});

test("LineView shows no alert banner when the line is clear", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill(flagsOff()),
  );
  await page.route(/\/api\/v1\/alerts(?:\?|$)/, (route) =>
    route.fulfill(alertsBody([])),
  );

  await page.goto(`/transit/line/${encodeURIComponent(LINE_ID)}`);

  await expect(
    page.locator(".line-card__number").filter({ hasText: "4" }),
  ).toBeVisible();
  await expect(page.locator("[data-testid='alert-banner']")).toHaveCount(0);
});

test("LineView folds a long alert list to a count summary", async ({
  page,
}) => {
  const many = Array.from({ length: 4 }, (_, i) => ({
    ...ROUTE_ALERT,
    id: `HSL:alert:e2e-${i}`,
    headline: { fi: `Tiedote ${i}`, en: `Alert ${i}` },
  }));
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill(flagsOff()),
  );
  await page.route(/\/api\/v1\/alerts(?:\?|$)/, (route) =>
    route.fulfill(alertsBody(many)),
  );

  await page.goto(`/transit/line/${encodeURIComponent(LINE_ID)}`);

  // Folded by default: no banners shown, a summary + expand control instead.
  await expect(page.locator("[data-testid='alert-banner']")).toHaveCount(0);
  const toggle = page.getByRole("button", { name: /Show alerts|Näytä/ });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(page.locator("[data-testid='alert-banner']")).toHaveCount(4);
});

test("the alert banner subtree is axe-clean", async ({ page }) => {
  await page.route(/\/api\/v1\/me\/feature-flags/, (route) =>
    route.fulfill(flagsOff()),
  );
  await page.route(/\/api\/v1\/alerts(?:\?|$)/, (route) =>
    route.fulfill(alertsBody([ROUTE_ALERT])),
  );

  await page.goto(`/transit/line/${encodeURIComponent(LINE_ID)}`);
  await expect(page.locator("[data-testid='alert-banner']")).toBeVisible();
  await expectNoSeriousA11yViolations(page, {
    include: "[data-testid='alert-banner']",
  });
});
