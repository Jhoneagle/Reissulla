import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { LayerControl } from "../LayerControl";
import { useMapStore } from "../../../stores/map";
import { DEFAULT_BASE_LAYER, DEFAULT_OVERLAYS } from "../layers";

function resetStore() {
  useMapStore.setState({
    baseLayer: DEFAULT_BASE_LAYER,
    overlays: new Set(DEFAULT_OVERLAYS),
    followMe: false,
    view: "map",
  });
}

describe("LayerControl", () => {
  afterEach(() => {
    resetStore();
    window.localStorage.clear();
  });

  it("opens the dialog and renders base-layer radios + overlay checkboxes", () => {
    renderWithProviders(<LayerControl />);
    fireEvent.click(screen.getByRole("button", { name: /choose map layers/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Streets" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Weather warnings" }),
    ).not.toBeChecked();
  });

  it("selecting the dark radio updates MapStore.baseLayer", () => {
    renderWithProviders(<LayerControl />);
    fireEvent.click(screen.getByRole("button", { name: /choose map layers/i }));

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(useMapStore.getState().baseLayer).toBe("tile-dark");
  });

  it("toggling the warnings checkbox updates MapStore.overlays", () => {
    renderWithProviders(<LayerControl />);
    fireEvent.click(screen.getByRole("button", { name: /choose map layers/i }));

    const box = screen.getByRole("checkbox", { name: "Weather warnings" });
    fireEvent.click(box);
    expect(useMapStore.getState().overlays.has("overlay-warnings")).toBe(true);
    fireEvent.click(box);
    expect(useMapStore.getState().overlays.has("overlay-warnings")).toBe(false);
  });

  it("ESC closes the dialog", () => {
    renderWithProviders(<LayerControl />);
    fireEvent.click(screen.getByRole("button", { name: /choose map layers/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("trigger toggles aria-pressed", () => {
    renderWithProviders(<LayerControl />);
    const trigger = screen.getByRole("button", { name: /choose map layers/i });
    expect(trigger).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-pressed", "true");
  });
});
