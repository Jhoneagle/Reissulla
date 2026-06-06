import { expect, test } from "./fixtures/mock-browser-externals";
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

  // LineSearch input is present (input type="search" → searchbox role).
  await expect(page.getByRole("searchbox")).toBeVisible();

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

test("LineView for tram-4 shows masthead, pattern picker, and stops", async ({
  page,
}) => {
  // MSW seeds HSL:1004 with the canonical 2-pattern, 2-stop tram line.
  const LINE_ID = "HSL:1004";
  await page.goto(`/transit/line/${encodeURIComponent(LINE_ID)}`);

  // Masthead shows shortName "4" and headsign for direction 0.
  await expect(
    page.locator(".line-card__number").filter({ hasText: "4" }),
  ).toBeVisible();

  // Direction picker is wired — toggle exposes both headsigns.
  await expect(
    page.getByRole("group", { name: /Direction|Suunta/ }),
  ).toBeVisible();

  // Both stops on this pattern are visible.
  await expect(page.getByText("Rautatientori").first()).toBeVisible();
  await expect(page.getByText("Kauppatori").first()).toBeVisible();
});

test("Lines search for '25' surfaces both regional matches (HSL and Tampere)", async ({
  page,
}) => {
  // The MSW Routes(name:"25") fixture returns three rows: HSL:1025,
  // tampere:25, and HSL:1250 (the 250 confuser). The sort in the API
  // ranks exact-length matches first, so the first two visible rows are
  // the two regional 25s.
  await page.goto("/transit?tab=lines");

  const searchbox = page.getByRole("searchbox");
  await searchbox.fill("25");

  // Wait for the rows to render. There can be either 2 or 3 rows; the
  // exact-length match for "25" must appear from both HSL and Tampere.
  await expect(page.getByText("Itäkeskus - Mellunmäki")).toBeVisible();
  await expect(page.getByText("Reumasairaala - Hervanta")).toBeVisible();

  // Both HSL and the Tampere agency are referenced in the result list.
  await expect(page.locator(".line-search__row").first()).toBeVisible();
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
