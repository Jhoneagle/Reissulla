import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Browser-side roadmap acceptance gates. The corresponding API
 * assertions live at `apps/api/src/__tests__/transit-acceptance.test.ts`.
 * This file proves the surfaces the user actually clicks render and stay
 * axe-clean.
 *
 * The 9 roadmap gates are split:
 *   1 (cross-region "25")        — covered here + transit-line-view.spec.ts
 *   2 (future-time picker)       — API-tested; surface smoke here
 *   3 (wheelchair persona)       — covered by auth-and-persona.spec.ts
 *   4 (Tikkurila inbound/outbound) — unit-tested via rail-clustering; FE
 *      smoke would need a RAIL stop fixture and is deferred
 *   5 (HEL → TPE → Pori)         — API-tested adapter routing; FE deferred
 *   6 (service-day edges)        — pure unit, no surface
 *   7 (schema snapshot)          — CI step, no surface
 *   8 (fi + en parity)           — API-tested
 *   9 (A11Y-19 both halves)      — covered here: low-floor chip on
 *      departures + low-floor cross-link to planner
 */

test("planner tab: low-floor preference cross-link is reachable from departures (gate 9)", async ({
  page,
}) => {
  // Deep-link the departure board with the low-floor filter ON so the
  // chip → planner cross-link is rendered. The A11Y-19 contract is that
  // a user who sets low-floor once on departures gets a one-click bridge
  // to also apply it to the planner.
  await page.goto("/transit?stopId=HSL%3A1040602&lowFloor=1");

  await expect(
    page.getByRole("heading", { level: 1, name: /Transit|Joukkoliikenne/ }),
  ).toBeAttached();

  // The filter panel sits inside a native <details>, collapsed by default.
  // Expand it so the low-floor controls are visible.
  await page
    .locator("details.departure-filters > summary.departure-filters__summary")
    .click();

  // The low-floor filter checkbox itself is checked.
  await expect(
    page.getByRole("checkbox", {
      name: /Low-floor vehicles only|Vain matalalattiakalusto/,
    }),
  ).toBeChecked();

  // The cross-link button to apply the same preference to the planner.
  await expect(
    page.getByRole("button", {
      name: /Apply low-floor preference to trip planning too|Käytä matalalattia-asetusta myös reittioppaassa/,
    }),
  ).toBeVisible();
});

test("planner page: advanced preferences expose avoid-stairs + avoid-transfers (gate 9 planner half)", async ({
  page,
}) => {
  await page.goto("/transit?tab=planner");

  // The active tab is Route Planner.
  await expect(
    page.getByRole("tab", { name: /Route Planner|Reittiopas/ }),
  ).toHaveAttribute("aria-selected", "true");

  // Expand the advanced controls — they're behind a native <details>.
  // The summary text is "More options" / "Lisävalinnat".
  const summary = page
    .locator("details.planner-controls__advanced > summary")
    .first();
  await summary.click();

  // The avoid-stairs checkbox is the persona-equivalent on the planner
  // side that A11Y-19 promises is wired through.
  await expect(
    page.getByRole("checkbox", { name: /Avoid stairs|Vältä portaita/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Avoid transfers|Vältä vaihtoja/ }),
  ).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test("planner page is axe-clean on the empty state", async ({ page }) => {
  // Phase 2's "0 critical / 0 serious on every Phase 2 page" gate. The
  // empty-state planner has been hit by a11y reviewers in other passes
  // but it isn't yet in the axe smoke set — bring it in here.
  await page.goto("/transit?tab=planner");
  await expect(
    page.getByRole("heading", { level: 1, name: /Transit|Joukkoliikenne/ }),
  ).toBeAttached();
  await expectNoSeriousA11yViolations(page);
});

test("line search '25' returns both HSL and Tampere agencies (gate 1 FE)", async ({
  page,
}) => {
  // MSW seeds routes(name:"25") with HSL:1025, tampere:25, HSL:1250.
  await page.goto("/transit?tab=lines");
  await page.getByRole("searchbox").fill("25");

  // Both agencies show up in the result list. Headsigns are the most
  // stable bit to match against because they bypass agency-label drift.
  await expect(page.getByText("Itäkeskus - Mellunmäki")).toBeVisible();
  await expect(page.getByText("Reumasairaala - Hervanta")).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});
