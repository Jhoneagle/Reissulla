import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { PinnedLinesCard } from "../PinnedLinesCard";

const useAuthStoreMock = vi.fn();
const usePinnedLinesMock = vi.fn();

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

vi.mock("../../../hooks/useTransit", () => ({
  usePinnedLines: (...a: unknown[]) => usePinnedLinesMock(...a),
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
  usePinnedLinesMock
    .mockReset()
    .mockReturnValue({ data: { data: [] }, isLoading: false });
});

describe("PinnedLinesCard", () => {
  it("renders nothing for anonymous users", () => {
    const { container } = renderWithProviders(<PinnedLinesCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the signed-in user has no pinned lines", () => {
    useAuthStoreMock.mockReturnValue({ id: "u1" });
    const { container } = renderWithProviders(<PinnedLinesCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per pin with mode tag + name + deep link", () => {
    useAuthStoreMock.mockReturnValue({ id: "u1" });
    usePinnedLinesMock.mockReturnValue({
      data: {
        data: [
          pin({ name: "25", vehicleMode: "BUS", gtfsId: "HSL:1025" }),
          pin({ id: "pin-2", name: "9", vehicleMode: "TRAM", gtfsId: "HSL:9" }),
        ],
      },
      isLoading: false,
    });
    renderWithProviders(<PinnedLinesCard />);
    const items = document.querySelectorAll(".pinned-lines-card__item");
    expect(items).toHaveLength(2);
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/transit/line/HSL%3A1025");
    expect(links[1]).toHaveAttribute("href", "/transit/line/HSL%3A9");
  });
});
