import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Line, PinnedLine } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { LineSearch } from "../LineSearch";

const useAuthStoreMock = vi.fn();
const useLineSearchMock = vi.fn();
const usePinnedLinesMock = vi.fn();
const usePreferencesMock = vi.fn();

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

vi.mock("../../../hooks/useTransit", () => ({
  useLineSearch: (...args: unknown[]) => useLineSearchMock(...args),
  usePinnedLines: (...args: unknown[]) => usePinnedLinesMock(...args),
  // LineSearch embeds LineCard which calls these — stub them so the
  // expanded state renders without firing real React Query.
  useLine: () => ({ isLoading: true, isError: false, data: undefined }),
  useLineDepartures: () => ({ data: undefined }),
  useFrequency: () => ({ data: undefined }),
  usePinLine: () => ({ mutate: vi.fn(), isPending: false }),
  useUnpinLine: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../hooks/usePreferences", () => ({
  usePreferences: () => usePreferencesMock(),
}));

function lineHit(overrides: Partial<Line> = {}): Line {
  return {
    gtfsId: "HSL:1025",
    shortName: "25",
    longName: "Kamppi – Itäkeskus",
    mode: "BUS",
    color: null,
    textColor: null,
    agency: { gtfsId: "HSL", name: "HSL" },
    ...overrides,
  };
}

function pinned(overrides: Partial<PinnedLine & { id: string }> = {}) {
  return {
    id: "pin-1",
    gtfsId: "HSL:1025",
    name: "25",
    vehicleMode: "BUS",
    pinnedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    ...overrides,
  };
}

const idleQuery = { data: undefined, isLoading: false, isError: false };

beforeEach(() => {
  useAuthStoreMock.mockReset().mockReturnValue(null);
  useLineSearchMock.mockReset().mockReturnValue(idleQuery);
  usePinnedLinesMock.mockReset().mockReturnValue({ data: { data: [] } });
  usePreferencesMock.mockReset().mockReturnValue({ data: undefined });
});

describe("LineSearch", () => {
  it("renders one expandable row per result, sorted by shortName length", async () => {
    useLineSearchMock.mockReturnValue({
      data: {
        data: [
          lineHit({ gtfsId: "a:25A", shortName: "25A", longName: "Variant" }),
          lineHit({ gtfsId: "a:25", shortName: "25", longName: "Trunk" }),
        ],
      },
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<LineSearch />);
    await user.type(screen.getByRole("searchbox"), "25");

    await waitFor(() => {
      expect(document.querySelectorAll(".line-search__row")).toHaveLength(2);
    });
    // The 2-char "25" sorts before "25A".
    const shortNames = Array.from(
      document.querySelectorAll(".line-search__short"),
    ).map((el) => el.textContent);
    expect(shortNames).toEqual(["25", "25A"]);
  });

  it("mounts LineCard inside the row when details fires its toggle event", async () => {
    useLineSearchMock.mockReturnValue({
      data: { data: [lineHit()] },
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<LineSearch />);
    await user.type(screen.getByRole("searchbox"), "25");

    const summary = await screen.findByText("Kamppi – Itäkeskus");
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    // jsdom doesn't auto-fire the `toggle` event when a summary click
    // flips <details>.open. Drive the wired effect directly: flip the
    // attribute, dispatch the bubbling toggle event LineSearch listens for.
    details.open = true;
    fireEvent(details, new Event("toggle", { bubbles: false }));
    expect(details.querySelector(".line-card--loading")).not.toBeNull();
  });

  it("offers a 'open as full page' link inside each expanded row", async () => {
    useLineSearchMock.mockReturnValue({
      data: { data: [lineHit({ gtfsId: "HSL:1025" })] },
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<LineSearch />);
    await user.type(screen.getByRole("searchbox"), "25");
    const summary = await screen.findByText("Kamppi – Itäkeskus");
    fireEvent.click(summary);

    const details = summary.closest("details")! as HTMLDetailsElement;
    const link = within(details).getByRole("link", {
      name: /open as full page/i,
    });
    expect(link).toHaveAttribute("href", "/transit/line/HSL%3A1025");
  });

  it("renders pinned chips when signed in and the query is empty", () => {
    useAuthStoreMock.mockReturnValue({
      id: "user-1",
      email: "x@example.com",
    });
    usePinnedLinesMock.mockReturnValue({
      data: {
        data: [pinned({ name: "25" }), pinned({ id: "pin-2", name: "9" })],
      },
    });

    renderWithProviders(<LineSearch />);

    const pinnedNav = screen.getByRole("navigation", {
      name: /pinned lines/i,
    });
    expect(pinnedNav).toBeInTheDocument();
    expect(pinnedNav.querySelectorAll("li")).toHaveLength(2);
  });

  it("shows the sign-in hint when anonymous with empty query", () => {
    renderWithProviders(<LineSearch />);
    expect(screen.getByText(/Sign in to pin lines/i)).toBeInTheDocument();
  });

  it("defaults the region facet to preferences.transitRegion", () => {
    usePreferencesMock.mockReturnValue({ data: { transitRegion: "hsl" } });
    renderWithProviders(<LineSearch />);
    const select = screen.getByRole("combobox", {
      name: /^region$/i,
    }) as HTMLSelectElement;
    expect(select.value).toBe("hsl");
  });
});
