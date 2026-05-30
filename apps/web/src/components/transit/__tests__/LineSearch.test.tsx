import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
  it("surfaces hits across regions when the query matches", async () => {
    const tampere = lineHit({
      gtfsId: "tampere:25",
      shortName: "25",
      longName: "Hervanta",
      agency: { gtfsId: "tampere", name: "Tampereen seudun joukkoliikenne" },
    });
    const hsl = lineHit({
      gtfsId: "HSL:1025",
      shortName: "25",
      longName: "Kamppi – Itäkeskus",
      agency: { gtfsId: "HSL", name: "HSL" },
    });
    useLineSearchMock.mockReturnValue({
      data: { data: [hsl, tampere] },
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<LineSearch />);
    await user.type(
      screen.getByRole("combobox", { name: /search a line/i }),
      "25",
    );

    const listbox = await screen.findByRole("listbox");
    await waitFor(() => {
      expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(2);
    });
    expect(screen.getByText("HSL")).toBeInTheDocument();
    expect(
      screen.getByText("Tampereen seudun joukkoliikenne"),
    ).toBeInTheDocument();
  });

  it("selects the highlighted row on Enter", async () => {
    const hsl = lineHit();
    useLineSearchMock.mockReturnValue({
      data: { data: [hsl] },
      isLoading: false,
      isError: false,
    });
    const onSelect = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(<LineSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: /search a line/i });
    await user.type(input, "25");
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => {
      expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(1);
    });
    // Arrow Down to highlight first row, then Enter.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(hsl);
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
