import { FormattedMessage, useIntl } from "react-intl";
import type {
  LegRoadImpact,
  RoadConditionSnapshot,
  RoadImpactReason,
} from "@reissulla/shared";

/**
 * Map the wire surface state (e.g. "icy") to the FE reason token (e.g.
 * "ice") the i18n catalogue uses. The two diverge because the wire shape
 * follows Fintraffic's spelling and the catalogue uses our shorter
 * snake-case keys.
 */
function surfaceToReason(
  surfaceState: RoadConditionSnapshot["surfaceState"],
): RoadImpactReason | null {
  switch (surfaceState) {
    case "icy":
      return "ice";
    case "partly-icy":
      return "partly-ice";
    case "snowy":
      return "snow";
    case "frosty":
      return "frost";
    case "moist-salty":
      return "slush";
    case "wet":
      return "wet";
    case "dry":
    case null:
      return null;
  }
}

interface DashboardChipProps {
  /** Dashboard variant — sourced from the weather snapshot. */
  condition: RoadConditionSnapshot | null;
  variant: "dashboard";
}

interface LegChipProps {
  /** Planner walk-leg variant — sourced from the leg's roadImpact + baseDuration. */
  impact: LegRoadImpact;
  baseDurationSeconds: number;
  adjustedDurationSeconds: number;
  variant: "leg";
}

export type RoadConditionChipProps = DashboardChipProps | LegChipProps;

/**
 * Road condition chip. Two variants:
 *
 * - `dashboard`: surfaces the FMI/Fintraffic surface state next to the
 *   weather snapshot ("Icy — allow extra time on foot"). Renders nothing
 *   when the surface is dry / unknown.
 * - `leg`: surfaces the planner-computed walking delta on a WALK leg
 *   ("+3 min ice"). Renders nothing when the leg has no `roadImpact`.
 *
 * Styling: text in `--color-warning`, icon stroke `currentColor`. The
 * chip has no background so it slides into a leg row or a card column
 * without becoming a button.
 */
export function RoadConditionChip(props: RoadConditionChipProps) {
  const intl = useIntl();

  if (props.variant === "dashboard") {
    const reason = surfaceToReason(props.condition?.surfaceState ?? null);
    if (reason === null) return null;
    const reasonLabel = intl.formatMessage({ id: `weather.road.${reason}` });
    return (
      <span className="road-chip" data-variant="dashboard" data-reason={reason}>
        <RoadIcon />
        <span className="road-chip__label">
          <FormattedMessage
            id="weather.road.dashboardChip"
            values={{ reasonLabel }}
          />
        </span>
      </span>
    );
  }

  const reason = props.impact.reason;
  const reasonLabel = intl.formatMessage({ id: `weather.road.${reason}` });
  const deltaSec = props.adjustedDurationSeconds - props.baseDurationSeconds;
  const deltaMin = Math.max(1, Math.round(deltaSec / 60));

  return (
    <span className="road-chip" data-variant="leg" data-reason={reason}>
      <RoadIcon />
      <span className="road-chip__label">
        <FormattedMessage
          id="weather.road.legDelta"
          values={{ minutes: deltaMin, reasonLabel: reasonLabel.toLowerCase() }}
        />
      </span>
    </span>
  );
}

function RoadIcon() {
  return (
    <svg
      className="road-chip__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Stylised winter-road triangle: snowflake inside a warning sign. */}
      <path d="M12 3 L22 21 L2 21 Z" />
      <path d="M12 10 V17" />
      <path d="M9 13 L15 13" />
    </svg>
  );
}
