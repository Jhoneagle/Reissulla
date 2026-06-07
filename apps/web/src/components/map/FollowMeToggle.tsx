import { useIntl } from "react-intl";
import { useMapStore } from "../../stores/map";
import { useGeolocationStore } from "../../stores/geolocation";

/**
 * MAP-7 toggle. Disabled when geolocation isn't available so the press
 * never produces a no-op; the disabled reason is communicated through
 * the title attribute for hover hint and via the aria-disabled state.
 */
export function FollowMeToggle() {
  const intl = useIntl();
  const followMe = useMapStore((s) => s.followMe);
  const setFollowMe = useMapStore((s) => s.setFollowMe);
  const hasPosition = useGeolocationStore((s) => s.position) !== null;
  const denied = useGeolocationStore((s) => s.denied);

  const disabled = !hasPosition || denied;
  const baseLabel = intl.formatMessage({
    id: followMe ? "map.followMe.label.on" : "map.followMe.label.off",
  });
  const reason = disabled
    ? intl.formatMessage({ id: "map.followMe.disabled" })
    : "";

  return (
    <button
      type="button"
      className="follow-me-toggle"
      aria-pressed={followMe}
      aria-disabled={disabled}
      aria-label={baseLabel}
      title={disabled ? reason : baseLabel}
      onClick={() => {
        if (disabled) return;
        setFollowMe(!followMe);
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  );
}
