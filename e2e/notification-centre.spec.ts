import { expect, test } from "./fixtures/mock-browser-externals";
import { expectNoSeriousA11yViolations, uniqueTestEmail } from "./helpers";

/**
 * Phase 4 acceptance — notification centre (roadmap done-when: "lists
 * today's alerts affecting pinned stops + lines; mark read / mark all
 * read; bell badge updates"). Auth is real against the dev:e2e API; the
 * composed `/api/v1/notifications` set is stubbed via page.route so the
 * grouping + read-state assertions are deterministic regardless of which
 * upstream alerts the MSW layer happens to surface.
 */

const TRANSIT_ALERT = {
  alert: {
    id: "HSL:alert:notif-1",
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: 1_700_000_000_000,
    endTime: null,
    scope: { kind: "route", gtfsId: "HSL:1004" },
    headline: { fi: "Linja 4 kiertää", en: "Route 4 detour" },
    description: { fi: "Poikkeusreitti käytössä.", en: "Detour in effect." },
  },
  unread: true,
};

const WEATHER_ALERT = {
  alert: {
    id: "FMI:alert:notif-2",
    source: "fmi",
    severity: "info",
    cause: null,
    effect: null,
    startTime: 1_700_000_000_000,
    endTime: 1_700_100_000_000,
    scope: { kind: "region", code: "FI:Uusimaa" },
    headline: { fi: "Tuulivaroitus", en: "Wind advisory" },
    description: { fi: "Kovaa tuulta.", en: "Strong winds." },
  },
  unread: false,
};

function json(body: unknown) {
  return { contentType: "application/json", body: JSON.stringify(body) };
}

async function signUp(page: import("@playwright/test").Page) {
  const email = uniqueTestEmail("notif");
  await page.goto("/register");
  await page.getByLabel(/Name|Nimi/).fill("Notification Test User");
  await page.getByLabel(/Email|Sähköposti/).fill(email);
  await page.getByLabel(/Password|Salasana/).fill("SecurePass123!");
  await page.getByRole("button", { name: /Create account|Luo tili/ }).click();
  await expect(page).toHaveURL(/\/settings/);
  await page
    .getByRole("button", { name: /Skip for now|Ohita toistaiseksi/ })
    .first()
    .click();
}

test("notification centre groups today's alerts and marks them read", async ({
  page,
}) => {
  // Stub the notification endpoints up-front so the nav bell's unread poll
  // and the list both read the canned set from first paint.
  await page.route(/\/api\/v1\/notifications\/unread-count/, (route) =>
    route.fulfill(json({ count: 1 })),
  );
  await page.route(/\/api\/v1\/notifications\/read-all/, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.route(/\/api\/v1\/notifications(?:\?|$)/, (route) =>
    route.fulfill(
      json({ data: [TRANSIT_ALERT, WEATHER_ALERT], unreadCount: 1 }),
    ),
  );

  await signUp(page);

  // Bell badge reflects the unread count.
  await expect(page.locator(".notification-bell__badge")).toHaveText("1");

  await page.goto("/notifications");

  // Source groups render, transit before weather.
  await expect(
    page.getByRole("heading", { name: /Transit|Liikenne/ }),
  ).toBeVisible();
  await expect(page.locator(".notification-item")).toHaveCount(2);
  await expect(page.getByText(/Route 4 detour|Linja 4 kiertää/)).toBeVisible();

  // Mark all read clears the unread affordance optimistically.
  await page
    .getByRole("button", { name: /Mark all read|Merkitse kaikki/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Mark all read|Merkitse kaikki/ }),
  ).toHaveCount(0);
});

test("the notification centre is axe-clean", async ({ page }) => {
  await page.route(/\/api\/v1\/notifications\/unread-count/, (route) =>
    route.fulfill(json({ count: 1 })),
  );
  await page.route(/\/api\/v1\/notifications(?:\?|$)/, (route) =>
    route.fulfill(
      json({ data: [TRANSIT_ALERT, WEATHER_ALERT], unreadCount: 1 }),
    ),
  );

  await signUp(page);
  await page.goto("/notifications");
  await expect(page.locator(".notification-item")).toHaveCount(2);
  await expectNoSeriousA11yViolations(page);
});

test("anonymous visitors get a sign-in CTA, not an empty centre", async ({
  page,
}) => {
  await page.goto("/notifications");
  await expect(
    page.getByRole("link", { name: /Sign in|Kirjaudu/ }),
  ).toBeVisible();
});
