import { expect, test } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations, uniqueTestEmail } from "./helpers";

/**
 * Phase 4 acceptance — trip-log opt-in (roadmap done-when: "opt-in
 * default off"). A fresh account's preferences carry `tripLogEnabled:
 * false`, so /history shows the opt-in CTA rather than a populated log —
 * this is the real-data assertion, no stub needed. The companion
 * round-trip (export covers the `trip_log` table) lives in
 * account-lifecycle.spec.ts.
 */

test("a new account sees the history opt-in CTA, off by default", async ({
  page,
}) => {
  const email = uniqueTestEmail("triplog");
  await page.goto("/register");
  await page.getByLabel(/Name|Nimi/).fill("Trip Log Test User");
  await page.getByLabel(/Email|Sähköposti/).fill(email);
  await page.getByLabel(/Password|Salasana/).fill("SecurePass123!");
  await page.getByRole("button", { name: /Create account|Luo tili/ }).click();
  await expect(page).toHaveURL(/\/settings/);
  await page
    .getByRole("button", { name: /Skip for now|Ohita toistaiseksi/ })
    .first()
    .click();

  await page.goto("/history");

  // Opt-in CTA is the default state — the enable button proves the trip log
  // starts off. A populated list or "logging is on" empty-state would mean
  // the default flipped on.
  const enable = page.getByRole("button", {
    name: /Enable trip history|Ota matkahistoria käyttöön/i,
  });
  await expect(enable).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test("anonymous visitors get a sign-in CTA on /history", async ({ page }) => {
  await page.goto("/history");
  await expect(
    page.getByRole("link", { name: /Sign in|Kirjaudu/ }),
  ).toBeVisible();
});
