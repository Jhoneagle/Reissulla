import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { Pattern } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { DirectionToggle } from "../DirectionToggle";

function pat(over: Partial<Pattern> = {}): Pattern {
  return {
    code: "HSL:1025:0:01",
    headsign: "Itäkeskus",
    directionId: 0,
    stops: [],
    ...over,
  };
}

describe("DirectionToggle", () => {
  it("renders two chips, marks the active direction pressed", () => {
    const patterns = [
      pat({ code: "a", headsign: "Itäkeskus", directionId: 0 }),
      pat({ code: "b", headsign: "Kamppi", directionId: 1 }),
    ];
    renderWithProviders(
      <DirectionToggle patterns={patterns} active={1} onChange={() => {}} />,
    );
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAttribute("aria-pressed", "false");
    expect(chips[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange with the chosen direction id", () => {
    const patterns = [
      pat({ code: "a", headsign: "Itäkeskus", directionId: 0 }),
      pat({ code: "b", headsign: "Kamppi", directionId: 1 }),
    ];
    const onChange = vi.fn();
    renderWithProviders(
      <DirectionToggle patterns={patterns} active={0} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /kamppi/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("renders nothing for one-way lines (single pattern)", () => {
    const { container } = renderWithProviders(
      <DirectionToggle patterns={[pat()]} active={0} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("filters out tram-loop directionId 2/3 and renders nothing when only one binary direction remains", () => {
    const patterns = [
      pat({ code: "a", directionId: 0 }),
      pat({ code: "b", directionId: 2 }),
      pat({ code: "c", directionId: 3 }),
    ];
    const { container } = renderWithProviders(
      <DirectionToggle patterns={patterns} active={0} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
