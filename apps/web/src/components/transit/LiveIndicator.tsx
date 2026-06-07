import { FormattedMessage } from "react-intl";
import type { LiveIndicatorState } from "../../hooks/useLiveDepartures";

interface LiveIndicatorProps {
  state: LiveIndicatorState;
}

/**
 * Three-state pill rendered in the departure-board masthead. State maps
 * to both colour and text — color-only signalling would fail WCAG 1.4.1
 * for users with the design-system's high-contrast theme on. Dot pulses
 * under .skel-pulse for the "live" state only; the reduce-motion gate
 * stops the pulse via the existing `body[data-reduce-motion="true"]`
 * rule in global.css.
 */
export function LiveIndicator({ state }: LiveIndicatorProps) {
  return (
    <span
      className={`live-indicator live-indicator--${state}`}
      data-state={state}
    >
      <span className="live-indicator__dot" aria-hidden="true" />
      <span className="live-indicator__label">
        <FormattedMessage id={`transit.live.indicator.${state}`} />
      </span>
    </span>
  );
}
