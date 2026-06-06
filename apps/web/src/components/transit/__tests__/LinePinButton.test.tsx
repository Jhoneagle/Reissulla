import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { LinePinButton } from "../LinePinButton";

const useAuthStoreMock = vi.fn();
const usePinnedLinesMock = vi.fn();
const usePinLineMock = vi.fn();
const useUnpinLineMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

vi.mock("../../../stores/toast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

vi.mock("../../../hooks/useTransit", () => ({
  usePinnedLines: (...args: unknown[]) => usePinnedLinesMock(...args),
  usePinLine: () => usePinLineMock(),
  useUnpinLine: () => useUnpinLineMock(),
}));

function mutationStub() {
  return { mutate: vi.fn(), isPending: false };
}

beforeEach(() => {
  useAuthStoreMock.mockReset().mockReturnValue({ id: "u1" });
  usePinnedLinesMock.mockReset().mockReturnValue({ data: { data: [] } });
  const pinM = mutationStub();
  const unpinM = mutationStub();
  usePinLineMock.mockReset().mockReturnValue(pinM);
  useUnpinLineMock.mockReset().mockReturnValue(unpinM);
  showToastMock.mockReset();
});

describe("LinePinButton", () => {
  it("renders unpressed when the line is not pinned and pins on click", () => {
    const pinM = mutationStub();
    usePinLineMock.mockReturnValue(pinM);
    renderWithProviders(
      <LinePinButton gtfsId="HSL:1025" name="25" vehicleMode="BUS" />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toHaveAttribute("disabled");
    fireEvent.click(btn);
    expect(pinM.mutate).toHaveBeenCalledWith({
      gtfsId: "HSL:1025",
      name: "25",
      vehicleMode: "BUS",
    });
  });

  it("renders pressed when the line is pinned and unpins on click", () => {
    usePinnedLinesMock.mockReturnValue({
      data: {
        data: [
          {
            id: "pin-1",
            gtfsId: "HSL:1025",
            name: "25",
            vehicleMode: "BUS",
            pinnedAt: "2026-01-01T00:00:00Z",
          },
        ],
      },
    });
    const unpinM = mutationStub();
    useUnpinLineMock.mockReturnValue(unpinM);
    renderWithProviders(
      <LinePinButton gtfsId="HSL:1025" name="25" vehicleMode="BUS" />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(btn);
    expect(unpinM.mutate).toHaveBeenCalledWith("pin-1");
  });

  it("anonymous user: button stays focusable, click fires sign-in toast", () => {
    useAuthStoreMock.mockReturnValue(null);
    renderWithProviders(
      <LinePinButton gtfsId="HSL:1025" name="25" vehicleMode="BUS" />,
    );
    const btn = screen.getByRole("button");
    // Stays focusable: no DOM disabled, tabbable.
    expect(btn).not.toHaveAttribute("disabled");
    expect(btn).toHaveAttribute("data-disabled", "true");
    // Carries the sign-in prompt in the accessible name.
    expect(btn).toHaveAccessibleName(/sign in to pin lines/i);
    fireEvent.click(btn);
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "info" }),
    );
  });
});
