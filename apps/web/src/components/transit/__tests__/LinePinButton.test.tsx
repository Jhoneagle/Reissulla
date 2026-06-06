import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/test-utils";
import { LinePinButton } from "../LinePinButton";
import { server } from "../../../test/msw/server";
import {
  getCapturedRequests,
  getLastMutation,
} from "../../../test/msw/request-log";

const useAuthStoreMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: useAuthStoreMock() }),
}));

vi.mock("../../../stores/toast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

beforeEach(() => {
  useAuthStoreMock.mockReset().mockReturnValue({ id: "u1" });
  showToastMock.mockReset();
});

describe("LinePinButton", () => {
  it("renders unpressed when the line is not pinned and pins on click", async () => {
    // Default handler returns empty pinned list — button is unpressed.
    const { container } = renderWithProviders(
      <LinePinButton gtfsId="HSL:1025" name="25" vehicleMode="BUS" />,
    );
    const btn = screen.getByRole("button");

    // Wait for the empty pinned-list query to resolve so the button knows
    // the line isn't pinned. The aria-pressed attribute reads `false`
    // synchronously since `data` is initially `undefined` → pinned=false.
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toHaveAttribute("disabled");

    const user = userEvent.setup();
    await user.click(btn);

    await waitFor(() => {
      const post = getLastMutation(
        (r) => r.method === "POST" && r.url.endsWith("/pinned-lines"),
      );
      expect(post).toBeDefined();
      expect(post!.body).toEqual({
        gtfsId: "HSL:1025",
        name: "25",
        vehicleMode: "BUS",
      });
    });
    expect(container).toBeTruthy();
  });

  it("renders pressed when the line is pinned and unpins on click", async () => {
    server.use(
      http.get("*/api/v1/transit/pinned-lines", () =>
        HttpResponse.json({
          data: [
            {
              id: "pin-1",
              gtfsId: "HSL:1025",
              name: "25",
              vehicleMode: "BUS",
              pinnedAt: "2026-01-01T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(
      <LinePinButton gtfsId="HSL:1025" name="25" vehicleMode="BUS" />,
    );
    const btn = screen.getByRole("button");

    await waitFor(() => {
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });

    const user = userEvent.setup();
    await user.click(btn);

    await waitFor(() => {
      const del = getLastMutation(
        (r) => r.method === "DELETE" && r.url.includes("/pinned-lines/pin-1"),
      );
      expect(del).toBeDefined();
    });
  });

  it("anonymous user: button stays focusable, click fires sign-in toast", async () => {
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

    const user = userEvent.setup();
    await user.click(btn);

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "info" }),
    );

    // No mutation request was made.
    const mutations = getCapturedRequests().filter(
      (r) => r.method === "POST" || r.method === "DELETE",
    );
    expect(mutations).toHaveLength(0);
  });
});
