import { FormattedMessage, useIntl } from "react-intl";
import type { TransitStop } from "@reissulla/shared";
import {
  usePinnedStops,
  usePinStop,
  useUnpinStop,
} from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { showToast } from "../../stores/toast";

interface PinButtonProps {
  stop: Pick<TransitStop, "gtfsId" | "name" | "vehicleMode" | "isStation">;
}

/**
 * Star toggle on the right of each departure-board header. Pin / unpin
 * round-trips through the authenticated /api/v1/transit/pinned-stops
 * endpoints; anonymous visitors see a toast inviting them to sign in.
 */
export function PinButton({ stop }: PinButtonProps) {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data } = usePinnedStops(Boolean(user));
  const pin = usePinStop();
  const unpin = useUnpinStop();

  const pinned = data?.data.find((p) => p.gtfsId === stop.gtfsId);
  const inFlight = pin.isPending || unpin.isPending;

  const handleClick = () => {
    if (!user) {
      showToast({
        message: intl.formatMessage({ id: "transit.pin.signInPrompt" }),
        kind: "info",
      });
      return;
    }
    if (pinned) {
      unpin.mutate(pinned.id);
    } else {
      pin.mutate({
        gtfsId: stop.gtfsId,
        name: stop.name,
        vehicleMode: stop.vehicleMode ?? null,
        isStation: stop.isStation ?? false,
      });
    }
  };

  const ariaId = pinned ? "transit.pin.unpinAria" : "transit.pin.pinAria";

  return (
    <button
      type="button"
      className={`pin-button${pinned ? " pin-button--pinned" : ""}`}
      onClick={handleClick}
      aria-pressed={Boolean(pinned)}
      aria-label={intl.formatMessage({ id: ariaId }, { name: stop.name })}
      disabled={inFlight}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span className="visually-hidden">
        <FormattedMessage
          id={pinned ? "transit.pin.unpin" : "transit.pin.pin"}
        />
      </span>
    </button>
  );
}
