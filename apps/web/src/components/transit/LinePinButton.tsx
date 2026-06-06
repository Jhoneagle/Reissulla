import { useIntl } from "react-intl";
import {
  usePinLine,
  usePinnedLines,
  useUnpinLine,
} from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { showToast } from "../../stores/toast";
import { vehicleModeToken } from "../../lib/transit-utils";

interface LinePinButtonProps {
  gtfsId: string;
  name: string;
  vehicleMode: string;
}

/**
 * Pin / unpin a line. Round-trips through /api/v1/transit/pinned-lines with
 * an optimistic flip in `usePinLine`. Anonymous riders see a sign-in toast on
 * click; the button stays in the tab order (no DOM `disabled` attribute) so
 * keyboard + screen-reader users can discover the affordance and read why
 * it's not yet active.
 */
export function LinePinButton({
  gtfsId,
  name,
  vehicleMode,
}: LinePinButtonProps) {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const modeToken = vehicleModeToken(vehicleMode);
  const { data } = usePinnedLines(Boolean(user));
  const pin = usePinLine();
  const unpin = useUnpinLine();

  const pinned = data?.data.find((p) => p.gtfsId === gtfsId);
  const inFlight = pin.isPending || unpin.isPending;

  const handleClick = () => {
    if (!user) {
      showToast({
        message: intl.formatMessage({ id: "transit.line.pin.signin" }),
        kind: "info",
      });
      return;
    }
    if (pinned) {
      unpin.mutate(pinned.id);
    } else {
      pin.mutate({ gtfsId, name, vehicleMode });
    }
  };

  const ariaLabel = !user
    ? intl.formatMessage({ id: "transit.line.pin.signin" })
    : pinned
      ? intl.formatMessage({ id: "transit.line.pin.remove" }, { line: name })
      : intl.formatMessage({ id: "transit.line.pin.add" }, { line: name });

  const className = [
    "line-pin-button",
    pinned ? "line-pin-button--pinned" : "",
    !user ? "line-pin-button--anonymous" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      data-mode={modeToken}
      data-disabled={!user ? "true" : undefined}
      aria-pressed={Boolean(pinned)}
      aria-label={ariaLabel}
      aria-busy={inFlight || undefined}
      onClick={handleClick}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={pinned ? `var(--mode-${modeToken}-strong)` : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
