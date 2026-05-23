import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";

/**
 * Smoke checks on the entry points anonymous users hit before signing in.
 * Each page is axe-core-clean for critical/serious violations.
 */

test("anonymous dashboard renders with no critical/serious a11y issues", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toContainText(
    /Dashboard|Etusivu/,
  );
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
