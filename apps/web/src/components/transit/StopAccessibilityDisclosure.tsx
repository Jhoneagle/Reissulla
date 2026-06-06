import { FormattedMessage, useIntl } from "react-intl";
import type { WheelchairBoarding } from "@reissulla/shared";
import { usePersonaStore } from "../../stores/persona";

interface StopAccessibilityDisclosureProps {
  wheelchairBoarding?: WheelchairBoarding;
}

/**
 * A11Y-20 — stop accessibility report rendered above the departure table.
 *
 * Only `wheelchairBoarding` is confirmed exposed by Digitransit GTFS feeds
 * today; the disclosure surfaces a single row when that's the only signal,
 * and renders nothing at all if the stop has no accessibility data. Other
 * UC-doc fields (tactile paving, audio announcements, accessible toilets)
 * stay out until the adapter actually returns them — inventing UI for
 * data we don't have leads to "Unknown" rows everywhere.
 *
 * Opens by default when the persona has any accessibility flag (the user
 * has already told us they care); closed otherwise so it doesn't crowd
 * the departure board for everyone else.
 */
export function StopAccessibilityDisclosure({
  wheelchairBoarding,
}: StopAccessibilityDisclosureProps) {
  const intl = useIntl();
  const persona = usePersonaStore((s) => s.persona);

  if (!wheelchairBoarding) return null;

  const hasA11yPersona =
    persona.wheelchair ||
    persona.noStairs ||
    persona.lowFloor ||
    persona.stroller;

  const statusLabel = intl.formatMessage({
    id: `transit.stopA11y.wheelchairBoarding.${wheelchairBoarding}`,
  });

  return (
    <details
      className={`stop-a11y stop-a11y--${wheelchairBoarding.toLowerCase()}`}
      open={hasA11yPersona}
    >
      <summary className="stop-a11y__summary">
        <span className="stop-a11y__kicker">
          <FormattedMessage id="transit.stopA11y.kicker" />
        </span>
        <span className="stop-a11y__heading">
          <FormattedMessage id="transit.stopA11y.heading" />
        </span>
      </summary>
      <dl className="stop-a11y__list">
        <div className="stop-a11y__row">
          <dt className="stop-a11y__label">
            <FormattedMessage id="transit.stopA11y.wheelchairBoarding.label" />
          </dt>
          <dd
            className={`stop-a11y__value stop-a11y__value--${wheelchairBoarding.toLowerCase()}`}
          >
            {statusLabel}
          </dd>
        </div>
      </dl>
    </details>
  );
}
