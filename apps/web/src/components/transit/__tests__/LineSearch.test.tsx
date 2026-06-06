import { HttpResponse, http } from "msw";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Line, PinnedLine } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { LineSearch } from "../LineSearch";
import { server } from "../../../test/msw/server";

const useAuthStoreMock = vi.fn();

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
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

function renderLineSearch(
  props: Partial<ComponentProps<typeof LineSearch>> = {},
) {
  return renderWithProviders(
    <LineSearch
      query=""
      region=""
      onQueryCommit={() => {}}
      onRegionChange={() => {}}
      {...props}
    />,
  );
}

beforeEach(() => {
  useAuthStoreMock.mockReset().mockReturnValue(null);
});

describe("LineSearch", () => {
  it("renders one row per result, sorted by shortName length", async () => {
    server.use(
      http.get("*/api/v1/transit/lines/search", () =>
        HttpResponse.json({
          data: [
            lineHit({ gtfsId: "a:25A", shortName: "25A", longName: "Variant" }),
            lineHit({ gtfsId: "a:25", shortName: "25", longName: "Trunk" }),
          ],
          cached: false,
        }),
      ),
    );

    const user = userEvent.setup();
    renderLineSearch();
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

  it("renders each result row as a link to the standalone line page", async () => {
    server.use(
      http.get("*/api/v1/transit/lines/search", () =>
        HttpResponse.json({
          data: [lineHit({ gtfsId: "HSL:1025" })],
          cached: false,
        }),
      ),
    );

    const user = userEvent.setup();
    renderLineSearch();
    await user.type(screen.getByRole("searchbox"), "25");

    const row = await screen.findByText("Kamppi – Itäkeskus");
    const link = row.closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", "/transit/line/HSL%3A1025");
    // No native disclosures left — the row IS the link.
    expect(document.querySelector("details")).toBeNull();
  });

  it("renders pinned chips when signed in and the query is empty", async () => {
    useAuthStoreMock.mockReturnValue({
      id: "user-1",
      email: "x@example.com",
    });
    server.use(
      http.get("*/api/v1/transit/pinned-lines", () =>
        HttpResponse.json({
          data: [
            pinned({ name: "25" }),
            pinned({ id: "pin-2", name: "9", gtfsId: "HSL:9" }),
          ],
        }),
      ),
    );

    renderLineSearch();

    const pinnedNav = await screen.findByRole("navigation", {
      name: /pinned lines/i,
    });
    expect(pinnedNav).toBeInTheDocument();
    expect(pinnedNav.querySelectorAll("li")).toHaveLength(2);
  });

  it("shows the sign-in hint when anonymous with empty query", () => {
    renderLineSearch();
    expect(screen.getByText(/Sign in to pin lines/i)).toBeInTheDocument();
  });

  it("defaults the region facet to preferences.transitRegion", async () => {
    // usePreferences is gated on auth — preferences only fetch for signed-in
    // users so the region default kicks in.
    useAuthStoreMock.mockReturnValue({ id: "u1", email: "x@example.com" });
    server.use(
      http.get("*/api/v1/preferences", () =>
        HttpResponse.json({ data: { transitRegion: "hsl" } }),
      ),
    );
    renderLineSearch();

    await waitFor(() => {
      const select = screen.getByRole("combobox", {
        name: /^region$/i,
      }) as HTMLSelectElement;
      expect(select.value).toBe("hsl");
    });
  });
});
