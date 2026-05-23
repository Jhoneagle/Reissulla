import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations, uniqueTestEmail } from "./helpers";

/**
 * Roadmap Phase 1 done-when:
 * - sign up → persona wizard → set wheelchair → assert persona persists.
 * The "plan trip with wheelchair flag in outgoing GraphQL" is covered at
 * the integration level (apps/api/src/__tests__/transit.test.ts), where
 * we can inspect the BE→Digitransit request body directly. The E2E
 * version asserts the FE half: persona is captured, stored, and sent on
 * subsequent requests via the x-reissulla-persona header.
 */

test("sign up + wizard sets wheelchair persona and sends it on subsequent API calls", async ({
  page,
}) => {
  const email = uniqueTestEmail("persona");
  const password = "SecurePass123!";

  // Register
  await page.goto("/register");
  await page.getByLabel(/Name|Nimi/).fill("Persona Test User");
  await page.getByLabel(/Email|Sähköposti/).fill(email);
  await page.getByLabel(/Password|Salasana/).fill(password);
  await page.getByRole("button", { name: /Create account|Luo tili/ }).click();

  // Lands on /settings?wizard=1
  await expect(page).toHaveURL(/\/settings/);
  await expect(
    page.getByRole("dialog", {
      name: /accessibility profile|saavutettavuusprofiili/i,
    }),
  ).toBeVisible();

  // Answer the first question (wheelchair) with Yes, then skip the rest.
  await page
    .getByRole("button", { name: /^Yes|^Kyllä/ })
    .first()
    .click();

  // Inspect: capture the next outbound /api/v1/* request and verify the
  // x-reissulla-persona header has wheelchair=1.
  const apiRequest = page.waitForRequest(
    (req) => req.url().includes("/api/v1/") && req.method() !== "OPTIONS",
  );

  // "Save" on the last step persists; click Next twice (the remaining
  // questions are unanswered → false) then Save.
  await page.getByRole("button", { name: /Next|Seuraava/ }).click();
  await page.getByRole("button", { name: /Next|Seuraava/ }).click();
  await page
    .getByRole("button", { name: /Save|Tallenna/ })
    .first()
    .click();

  // Settings page should now show the wheelchair toggle checked.
  await expect(
    page.getByLabel(/Wheelchair-accessible routing|Pyörätuolireitti/),
  ).toBeChecked();

  // Whichever API request fires next should carry the persona header.
  const req = await apiRequest;
  const personaHeader = req.headers()["x-reissulla-persona"];
  expect(personaHeader).toBeTruthy();
  expect(personaHeader).toMatch(/wheelchair=1/);

  await expectNoSeriousA11yViolations(page);
});

test("magic-link prompt renders without exposing any captcha challenge UI", async ({
  page,
}) => {
  await page.goto("/login");

  await page
    .getByLabel(/Email|Sähköposti/)
    .fill("e2e-magic@test.reissulla.local");

  // Click the explicit "Email me a sign-in link" button.
  await page
    .getByRole("button", {
      name: /Email me a sign-in link|Lähetä kirjautumislinkki/,
    })
    .click();

  // "Check your email" state appears; no challenge iframe should ever
  // render in the auth flow (the magic-link path is the documented
  // fallback for low recaptcha scores too, so the same UI carries both
  // explicit and automatic flows).
  await expect(
    page.getByRole("heading", {
      name: /Check your email|Tarkista sähköpostisi/,
    }),
  ).toBeVisible();
  await expect(page.locator('iframe[title*="reCAPTCHA"]')).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);
});
