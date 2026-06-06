import { FormattedMessage, useIntl } from "react-intl";
import type { TransitItineraryLeg } from "@reissulla/shared";
import {
  formatDuration,
  formatWalkDistance,
  vehicleModeLabel,
  vehicleModeColor,
} from "../../lib/transit-utils";

const RIGHT_ARROW = "→";

interface ItineraryLegProps {
  leg: TransitItineraryLeg;
}

function relativeDirectionMessageId(direction: string): string {
  // OTP2 returns LEFT / RIGHT / SLIGHTLY_LEFT / SLIGHTLY_RIGHT / CONTINUE /
  // HARD_LEFT / HARD_RIGHT / UTURN / DEPART / ARRIVE / CIRCLE_*. We don't
  // need a glossary entry for every variant — the unknown branch reads as
  // "Continue", which matches OTP2's CONTINUE semantics.
  switch (direction) {
    case "LEFT":
    case "HARD_LEFT":
    case "SLIGHTLY_LEFT":
      return "transit.leg.steps.left";
    case "RIGHT":
    case "HARD_RIGHT":
    case "SLIGHTLY_RIGHT":
      return "transit.leg.steps.right";
    case "DEPART":
      return "transit.leg.steps.depart";
    case "ARRIVE":
      return "transit.leg.steps.arrive";
    case "UTURN_LEFT":
    case "UTURN_RIGHT":
      return "transit.leg.steps.uturn";
    default:
      return "transit.leg.steps.continue";
  }
}

export function ItineraryLeg({ leg }: ItineraryLegProps) {
  const intl = useIntl();
  const isWalk = leg.mode === "WALK";
  const color = vehicleModeColor(leg.mode);
  const stopsCount = leg.intermediateStops?.length ?? 0;
  const stepsCount = leg.steps?.length ?? 0;

  return (
    <div className={`leg${isWalk ? " leg--walk" : ""}`}>
      <div className="leg__timeline" aria-hidden="true">
        <span className="leg__dot" style={{ borderColor: color }} />
        <span
          className={`leg__line${isWalk ? " leg__line--dashed" : ""}`}
          style={{ borderColor: color }}
        />
      </div>
      <div className="leg__content">
        {isWalk ? (
          <>
            <p className="leg__summary">
              <span
                className="leg__mode-label"
                style={{ marginRight: "0.25em" }}
              >
                <FormattedMessage id="transit.leg.walk" />
              </span>
              <span className="leg__detail">
                <FormattedMessage
                  id="transit.leg.walkDetail"
                  values={{
                    duration: formatDuration(leg.duration),
                    distance: formatWalkDistance(leg.distance),
                  }}
                />
              </span>
            </p>
            {stepsCount > 0 && (
              <details className="leg__steps">
                <summary>
                  <FormattedMessage
                    id="transit.leg.steps.summary"
                    values={{ n: stepsCount }}
                  />
                </summary>
                <ol className="leg__steps-list">
                  {leg.steps!.map((step, i) => (
                    <li key={`${step.streetName}-${i}`}>
                      <FormattedMessage
                        id="transit.leg.steps.row"
                        values={{
                          direction: intl.formatMessage({
                            id: relativeDirectionMessageId(
                              step.relativeDirection,
                            ),
                          }),
                          street: step.streetName,
                          distance: formatWalkDistance(step.distance),
                        }}
                      />
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        ) : (
          <>
            <p className="leg__summary">
              {leg.route && (
                <span
                  className="mode-badge mode-badge--sm"
                  style={{ backgroundColor: color }}
                >
                  {leg.route.shortName}
                </span>
              )}
              <span className="leg__mode-label">
                {vehicleModeLabel(leg.mode)}
              </span>
              <span className="leg__arrow" aria-hidden="true">
                {RIGHT_ARROW}
              </span>
              <span className="leg__headsign">{leg.to.name}</span>
            </p>
            <p className="leg__detail">
              {formatDuration(leg.duration)}
              {stopsCount > 0 && (
                <FormattedMessage
                  id="transit.leg.stopsCount"
                  values={{ count: stopsCount }}
                />
              )}
            </p>
            {leg.operator && (
              <p className="leg__operator">
                <FormattedMessage
                  id="transit.leg.operator"
                  values={{ name: leg.operator.name }}
                />
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
