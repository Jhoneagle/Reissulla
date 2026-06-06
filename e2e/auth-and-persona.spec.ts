import { test, expect } from "./fixtures/mock-browser-externals";
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
  const wizard = page.getByRole("dialog", {
    name: /accessibility profile|saavutettavuusprofiili/i,
  });
  await expect(wizard).toBeVisible();

  // Answer the first question (wheelchair) with Yes. Scope all wizard
  // controls to the dialog itself so we don't accidentally match the
  // Settings page's Profile "Save" button or other duplicate roles.
  await wizard.getByRole("radio", { name: /^Yes|^Kyllä/ }).click();

  // After auto-advance from step 1, we're on step 2. Click Next to
  // step 3 (skipping = null, not false — wire encoder drops it), then
  // Finish to persist.
  await wizard.getByRole("button", { name: /Next|Seuraava/ }).click();
  await wizard.getByRole("button", { name: /Finish|Valmis/ }).click();

  // Settings page should now show the wheelchair toggle checked.
  await expect(
    page.getByLabel(/Wheelchair-accessible routing|Pyörätuolireitti/),
  ).toBeChecked();

  // Navigate somewhere that fires an API call after the persona has been
  // committed — that request should carry x-reissulla-persona. Capture
  // it before the navigation so the listener is armed.
  const apiRequest = page.waitForRequest(
    (req) =>
      req.url().includes("/api/v1/") &&
      req.method() === "GET" &&
      !req.url().endsWith("/api/v1/me"),
  );
  await page.goto("/");
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
