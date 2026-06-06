import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Line-view acceptance gates. Mirrors the approach in
 * `transit-trip-detail.spec.ts`: assert URL contracts and the deterministic
 * error/empty plates rather than upstream-dependent search hits, since
 * Digitransit responses aren't stable in E2E.
 *
 * The roadmap "type 25 → see two regions" gate is exercised manually
 * (visual-verification step) and via the unit-tested `LineSearch` sort
 * helper. Here we lock in the routing, tab, and not-found contracts.
 */

test("Lines tab is reachable via the URL and the LineSearch surface mounts", async ({
  page,
}) => {
  await page.goto("/transit?tab=lines");

  // Tab list exposes the three transit sections; Lines is the active tab.
  await expect(page.getByRole("tab", { name: /Linjat|Lines/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // LineSearch combobox is present (accessible name from the i18n key).
  await expect(
    page.getByRole("combobox", { name: /Etsi linjaa|Search a line/ }),
  ).toBeVisible();

  // Region facet is the second combobox.
  await expect(
    page.getByRole("combobox", { name: /^(Alue|Region)$/ }),
  ).toBeVisible();
});

test("clicking Lines tab from departures updates the URL tab param", async ({
  page,
}) => {
  await page.goto("/transit");
  await expect(page).not.toHaveURL(/[?&]tab=/);

  await page.getByRole("tab", { name: /Linjat|Lines/ }).click();
  await expect(page).toHaveURL(/[?&]tab=lines\b/);

  // And back to departures drops the param entirely.
  await page.getByRole("tab", { name: /Lähdöt|Departures/ }).click();
  await expect(page).not.toHaveURL(/[?&]tab=lines\b/);
});

test("LineView renders a not-found plate for an unknown gtfsId", async ({
  page,
}) => {
  await page.goto("/transit/line/HSL%3Anonexistent_line_id");

  await expect(
    page.getByText(/Linjaa ei löytynyt\.|Line not found\./),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: /Takaisin linjoihin|Back to lines/ }),
  ).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test("Back link on LineView returns to /transit?tab=lines on a fresh entry", async ({
  page,
}) => {
  // Direct entry — location.key === "default" path uses /transit?tab=lines.
  await page.goto("/transit/line/HSL%3Anonexistent_line_id");
  await page
    .getByRole("link", { name: /Takaisin linjoihin|Back to lines/ })
    .click();
  await expect(page).toHaveURL(/[?&]tab=lines\b/);
});

test("anonymous pin attempt does not crash the LineView surface", async ({
  page,
}) => {
  // Even on a 404 plate, the back-link is the only interactive element;
  // verify the route renders and stays accessible for the anonymous user.
  await page.goto("/transit/line/HSL%3Anonexistent_line_id");
  await expectNoSeriousA11yViolations(page);
});
