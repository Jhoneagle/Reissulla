import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alert, NotifiedAlert } from "@reissulla/shared";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
  useUnreadCount: vi.fn(),
  useMarkRead: vi.fn(),
  useMarkAllRead: vi.fn(),
}));
vi.mock("../../stores/auth", () => ({ useAuthStore: vi.fn() }));
vi.mock("../../hooks/usePreferences", () => ({ usePreferences: vi.fn() }));

import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "../../hooks/useNotifications";
import { useAuthStore } from "../../stores/auth";
import { usePreferences } from "../../hooks/usePreferences";
import { Notifications } from "../Notifications";
import { NotificationBell } from "../../components/NotificationBell";

function makeAlert(over: Partial<Alert> = {}): Alert {
  return {
    id: "HSL:alert:1",
    source: "digitransit",
    severity: "warning",
    cause: "MAINTENANCE",
    effect: "DETOUR",
    startTime: Date.now() - 60_000,
    endTime: Date.now() + 6 * 60 * 60 * 1000,
    scope: { kind: "route", gtfsId: "HSL:1014" },
    headline: { fi: "Linja 14 kiertää", en: "Route 14 detour" },
    description: { fi: "Poikkeusreitti.", en: "Detour in effect." },
    ...over,
  };
}

function notified(alert: Alert, unread: boolean): NotifiedAlert {
  return { alert, unread };
}

function signedIn(user: { id: string; name: string } | null) {
  vi.mocked(useAuthStore).mockImplementation((sel: unknown) =>
    (sel as (s: { user: typeof user }) => unknown)({ user }),
  );
}

const markReadMutate = vi.fn();
const markAllReadMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  signedIn({ id: "u1", name: "Test" });
  vi.mocked(usePreferences).mockReturnValue({
    data: { srOptimised: false, extra: {} },
  } as never);
  vi.mocked(useMarkRead).mockReturnValue({ mutate: markReadMutate } as never);
  vi.mocked(useMarkAllRead).mockReturnValue({
    mutate: markAllReadMutate,
  } as never);
  vi.mocked(useUnreadCount).mockReturnValue({ data: 0 } as never);
});

describe("NotificationBell", () => {
  it("renders the unread count in its accessible name and badge", () => {
    vi.mocked(useUnreadCount).mockReturnValue({ data: 5 } as never);
    renderWithProviders(<NotificationBell />);
    const link = screen.getByRole("link", { name: /5 unread alerts/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("5");
  });

  it("renders at zero with a no-unread label and no badge", () => {
    vi.mocked(useUnreadCount).mockReturnValue({ data: 0 } as never);
    renderWithProviders(<NotificationBell />);
    expect(
      screen.getByRole("link", { name: /no unread alerts/i }),
    ).toBeInTheDocument();
  });

  it("caps the badge at 99+", () => {
    vi.mocked(useUnreadCount).mockReturnValue({ data: 150 } as never);
    renderWithProviders(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("renders nothing for anonymous users", () => {
    signedIn(null);
    vi.mocked(useUnreadCount).mockReturnValue({ data: 0 } as never);
    const { container } = renderWithProviders(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Notifications page", () => {
  it("lists alerts grouped by source with unread state", () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: {
        data: [
          notified(makeAlert({ id: "a1" }), true),
          notified(makeAlert({ id: "a2", severity: "severe" }), false),
        ],
        unreadCount: 1,
      },
      isLoading: false,
    } as never);

    renderWithProviders(<Notifications />);
    expect(
      screen.getByRole("heading", { name: /transit/i, level: 3 }),
    ).toBeInTheDocument();
    // Only the unread alert exposes a "Mark read" button.
    expect(screen.getAllByRole("button", { name: /mark read/i })).toHaveLength(
      1,
    );
  });

  it("marks a single alert read on click", async () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: [notified(makeAlert({ id: "a1" }), true)], unreadCount: 1 },
      isLoading: false,
    } as never);

    renderWithProviders(<Notifications />);
    await userEvent.click(screen.getByRole("button", { name: /mark read/i }));
    expect(markReadMutate).toHaveBeenCalledWith(["a1"]);
  });

  it("shows the empty state when there are no alerts", () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: [], unreadCount: 0 },
      isLoading: false,
    } as never);

    renderWithProviders(<Notifications />);
    expect(screen.getByText(/no alerts today/i)).toBeInTheDocument();
  });

  it("shows a sign-in CTA for anonymous users", () => {
    signedIn(null);
    vi.mocked(useNotifications).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);

    renderWithProviders(<Notifications />);
    expect(
      screen.getByText(/sign in to see your notifications/i),
    ).toBeInTheDocument();
  });
});
