import { FormattedMessage, useIntl } from "react-intl";
import type {
  TransitDeparture,
  TransitDepartureByDirection,
} from "@reissulla/shared";
import type { ArrivalDepartureMode } from "@reissulla/api-client";
import { DepartureRow } from "./DepartureRow";

interface DepartureDirectionSplitProps {
  byDirection: TransitDepartureByDirection;
  mode: ArrivalDepartureMode;
  /** Stop / station display name — drives the SR-only group caption. */
  stopName: string;
}

/**
 * DEP-3 — commuter-rail inbound/outbound side-by-side layout.
 *
 * Renders two `<section aria-labelledby>` regions whose visible label is
 * the direction (italic display Roman with an arrow glyph). At desktop
 * widths CSS lays them out as two columns; at narrow widths they stack
 * with a sticky direction heading per group.
 *
 * The `other` bucket — short-turn or anomalous trips that didn't fit
 * either dominant direction — surfaces inline above the split so those
 * rows aren't dropped from the user's view.
 */
export function DepartureDirectionSplit({
  byDirection,
  mode,
  stopName,
}: DepartureDirectionSplitProps) {
  const intl = useIntl();
  const { a, b, other } = byDirection;

  return (
    <div className="departure-split">
      {other.length > 0 && (
        <section
          className="departure-split__other"
          aria-label={intl.formatMessage(
            { id: "transit.depart.byDirection.otherCaption" },
            { stopName },
          )}
        >
          <h4 className="departure-split__other-heading">
            <FormattedMessage id="transit.depart.byDirection.other" />
          </h4>
          <DirectionalList
            departures={other}
            mode={mode}
            headingId="dep-split-other"
          />
        </section>
      )}

      <div className="departure-split__grid">
        <DirectionalSection
          headingId="dep-split-a"
          label={a.label}
          departures={a.departures}
          mode={mode}
        />
        <DirectionalSection
          headingId="dep-split-b"
          label={b.label}
          departures={b.departures}
          mode={mode}
        />
      </div>
    </div>
  );
}

interface DirectionalSectionProps {
  headingId: string;
  label: string;
  departures: TransitDeparture[];
  mode: ArrivalDepartureMode;
}

function DirectionalSection({
  headingId,
  label,
  departures,
  mode,
}: DirectionalSectionProps) {
  return (
    <section className="departure-split__col" aria-labelledby={headingId}>
      <h4 id={headingId} className="departure-split__heading">
        {label}
      </h4>
      {departures.length === 0 ? (
        <p className="departure-split__empty">
          <FormattedMessage id="transit.depart.byDirection.empty" />
        </p>
      ) : (
        <DirectionalList
          departures={departures}
          mode={mode}
          headingId={headingId}
        />
      )}
    </section>
  );
}

function DirectionalList({
  departures,
  mode,
}: {
  departures: TransitDeparture[];
  mode: ArrivalDepartureMode;
  headingId: string;
}) {
  return (
    <ol className="departure-list departure-list--split">
      {departures.map((dep, i) => (
        <DepartureRow
          key={`${dep.routeShortName}-${dep.serviceDay}-${dep.scheduledDeparture}-${i}`}
          departure={dep}
          mode={mode}
          showPlatform={false}
        />
      ))}
    </ol>
  );
}
