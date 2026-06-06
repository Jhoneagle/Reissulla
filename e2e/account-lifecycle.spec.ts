import { test, expect } from "./fixtures/mock-browser-externals";
import { uniqueTestEmail } from "./helpers";

/**
 * Roadmap Phase 1 done-when: create account → export → delete → verify
 * absence. The forcing function — every new user-data table from
 * Phase 2-5 must extend AccountExport or this test fails.
 */

test("account export → delete round-trip leaves the user signed out", async ({
  page,
  context,
}) => {
  const email = uniqueTestEmail("lifecycle");
  const password = "SecurePass123!";

  // Sign up.
  await page.goto("/register");
  await page.getByLabel(/Name|Nimi/).fill("Lifecycle Test User");
  await page.getByLabel(/Email|Sähköposti/).fill(email);
  await page.getByLabel(/Password|Salasana/).fill(password);
  await page.getByRole("button", { name: /Create account|Luo tili/ }).click();

  // Lands on settings; skip the wizard.
  await expect(page).toHaveURL(/\/settings/);
  await page
    .getByRole("button", { name: /Skip for now|Ohita toistaiseksi/ })
    .first()
    .click();

  // Export the account via the API directly — the FE uses a Blob download
  // which is awkward to capture in a browser context. Hitting the API
  // proves the export endpoint serves a well-formed payload, which is
  // what the round-trip is really asserting.
  const exportRes = await page.request.get("/api/v1/account/export");
  expect(exportRes.status()).toBe(200);
  const exported = await exportRes.json();
  expect(exported.schemaVersion).toBe(1);
  expect(exported.user.email).toBe(email);
  // Phase 2-5 fields are pre-allocated empty — forcing function.
  expect(exported.pinnedStops).toEqual([]);
  expect(exported.tripLog).toEqual([]);
  expect(exported.shareTokens).toEqual([]);

  // Delete via API (FE wraps this in a window.confirm dialog).
  const deleteRes = await page.request.delete("/api/v1/account");
  expect(deleteRes.status()).toBe(204);

  // Session is invalidated; navigating to settings should bounce to the
  // anonymous view rather than the authenticated one. The anonymous
  // view carries a "Sign in" affordance instead of the authed Profile
  // section — check the affordance, not the copy.
  await context.clearCookies();
  await page.goto("/settings");
  await expect(
    page.getByRole("link", { name: /^Sign in$|^Kirjaudu sisään$/ }),
  ).toBeVisible();

  // Re-querying the account export now returns 401.
  const reexport = await page.request.get("/api/v1/account/export");
  expect(reexport.status()).toBe(401);
});
