import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { PinnedLinesCard } from "../PinnedLinesCard";
import { server } from "../../../test/msw/server";

const useAuthStoreMock = vi.fn();

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

function pin(
  over: Partial<{
    id: string;
    gtfsId: string;
    name: string;
    vehicleMode: string;
  }> = {},
) {
  return {
    id: "pin-1",
    gtfsId: "HSL:1025",
    name: "25",
    vehicleMode: "BUS",
    pinnedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  useAuthStoreMock.mockReset().mockReturnValue(null);
});

describe("PinnedLinesCard", () => {
  it("renders nothing for anonymous users", () => {
    // No network call when anonymous — usePinnedLines disables itself.
    const { container } = renderWithProviders(<PinnedLinesCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the signed-in user has no pinned lines", async () => {
    useAuthStoreMock.mockReturnValue({ id: "u1" });
    const { container } = renderWithProviders(<PinnedLinesCard />);
    // Default handler returns empty list — container stays empty after
    // the query resolves.
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("renders one row per pin with mode tag + name + deep link", async () => {
    useAuthStoreMock.mockReturnValue({ id: "u1" });
    server.use(
      http.get("*/api/v1/transit/pinned-lines", () =>
        HttpResponse.json({
          data: [
            pin({ name: "25", vehicleMode: "BUS", gtfsId: "HSL:1025" }),
            pin({
              id: "pin-2",
              name: "9",
              vehicleMode: "TRAM",
              gtfsId: "HSL:9",
            }),
          ],
        }),
      ),
    );
    renderWithProviders(<PinnedLinesCard />);

    await waitFor(() => {
      const items = document.querySelectorAll(".pinned-lines-card__item");
      expect(items).toHaveLength(2);
    });
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    // Each row carries the main deep-link plus a "View live" deep-link.
    const mainLinks = document.querySelectorAll(".pinned-lines-card__link");
    expect(mainLinks[0]).toHaveAttribute("href", "/transit/line/HSL%3A1025");
    expect(mainLinks[1]).toHaveAttribute("href", "/transit/line/HSL%3A9");
    const liveLinks = document.querySelectorAll(".pinned-lines-card__live");
    expect(liveLinks[0]).toHaveAttribute(
      "href",
      "/transit/line/HSL%3A1025#live",
    );
    expect(liveLinks[1]).toHaveAttribute("href", "/transit/line/HSL%3A9#live");
  });
});
