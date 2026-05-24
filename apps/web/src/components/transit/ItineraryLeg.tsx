import { FormattedMessage } from "react-intl";
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

export function ItineraryLeg({ leg }: ItineraryLegProps) {
  const isWalk = leg.mode === "WALK";
  const color = vehicleModeColor(leg.mode);
  const stopsCount = leg.intermediateStops?.length ?? 0;

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
          <p className="leg__summary">
            <span className="leg__mode-label" style={{ marginRight: "0.25em" }}>
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
          </>
        )}
      </div>
    </div>
  );
}
