import { test, expect } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Smoke checks on the entry points anonymous users hit before signing in.
 * Each page is axe-core-clean for critical/serious violations.
 */

test("anonymous dashboard renders with no critical/serious a11y issues", async ({
  page,
}) => {
  await page.goto("/");
  // The Dashboard's only visible heading is the kicker (decorative,
  // aria-hidden). The semantic page heading is the visually-hidden h1
  // owned by PageHeading — match against that.
  await expect(
    page.getByRole("heading", { level: 1, name: /Dashboard|Etusivu/ }),
  ).toBeAttached();
  await expectNoSeriousA11yViolations(page);
});

test("login page renders with no critical/serious a11y issues", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { level: 2, name: /Log in|Kirjaudu/ }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("register page renders with no critical/serious a11y issues", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: /Create an account|Luo tili/,
    }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("settings page renders without signing in", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { level: 2, name: /Settings|Asetukset/ }),
  ).toBeVisible();
});
