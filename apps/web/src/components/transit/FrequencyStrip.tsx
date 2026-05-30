import { FormattedMessage, useIntl } from "react-intl";
import {
  isSparseBand,
  type DayType,
  type FrequencyBand,
} from "@reissulla/shared";
import { vehicleModeToken } from "../../lib/transit-utils";
import {
  barHeight,
  buildGridColumns,
  minutesBetween,
  rangeLabel,
} from "./frequency-strip-helpers";
import "./frequency-strip.css";

interface FrequencyStripProps {
  bands: FrequencyBand[];
  modeToken: string;
  dayType: DayType;
  onDayTypeChange: (next: DayType) => void;
}

const DAY_TYPES: { value: DayType; labelId: string }[] = [
  { value: "weekday", labelId: "transit.line.dayType.weekday" },
  { value: "saturday", labelId: "transit.line.dayType.saturday" },
  { value: "sunday", labelId: "transit.line.dayType.sunday" },
];

function PeriodSentence({ band }: { band: FrequencyBand }) {
  const intl = useIntl();
  return (
    <p className="visually-hidden">
      {intl.formatMessage(
        { id: "transit.line.freq.sr" },
        {
          period: rangeLabel(band),
          from: band.fromTimeOfDay,
          to: band.toTimeOfDay,
          headway: band.headwayMin,
        },
      )}
    </p>
  );
}

/**
 * Frequency strip — day-type tabs above a column-grid of bars whose widths
 * scale to band duration and heights scale inversely with headway. The visual
 * bars carry no semantic role; each band emits a `visually-hidden` SR
 * sentence in DOM order before the grid so a screen reader gets the full
 * shape of the day without traversing the decorative DOM.
 *
 * Sparse-day path (single band, `headwayMin === -1`) swaps the grid for an
 * editorial caption listing the literal trip times — useful for branch lines
 * with 2–4 trips/day where a headway average would mislead.
 */
export function FrequencyStrip({
  bands,
  modeToken,
  dayType,
  onDayTypeChange,
}: FrequencyStripProps) {
  const intl = useIntl();
  const safeToken = vehicleModeToken(modeToken);
  const sparse =
    bands.length === 1 && bands[0] !== undefined && isSparseBand(bands[0]);

  return (
    <section
      className={`freq-strip freq-strip--mode-${safeToken}`}
      aria-label={intl.formatMessage({ id: "transit.line.freq.label" })}
    >
      <nav
        className="freq-strip__tabs"
        aria-label={intl.formatMessage({ id: "transit.line.freq.label" })}
      >
        {DAY_TYPES.map((day) => (
          <button
            key={day.value}
            type="button"
            className="freq-strip__tab"
            aria-current={day.value === dayType ? "page" : undefined}
            onClick={() => onDayTypeChange(day.value)}
          >
            <FormattedMessage id={day.labelId} />
          </button>
        ))}
      </nav>

      {bands.length === 0 && (
        <p className="freq-strip__empty">
          <FormattedMessage id="transit.line.freq.empty" />
        </p>
      )}

      {sparse && bands[0] && <SparseDay band={bands[0]} />}

      {!sparse && bands.length > 0 && (
        <>
          {bands.map((band, i) => (
            <PeriodSentence key={`sr-${i}`} band={band} />
          ))}
          <div
            className="freq-strip__bars"
            style={{ gridTemplateColumns: buildGridColumns(bands) }}
            aria-hidden="true"
          >
            {bands.map((band, i) => (
              <div className="freq-strip__column" key={`col-${i}`}>
                <div
                  className="freq-strip__bar"
                  style={{ height: `${barHeight(band.headwayMin)}px` }}
                  data-headway={band.headwayMin}
                  data-width-min={minutesBetween(band)}
                />
                <span className="freq-strip__caption">{rangeLabel(band)}</span>
                <details className="freq-strip__headway-mobile">
                  <summary className="freq-strip__caption freq-strip__caption--headway">
                    {intl.formatMessage(
                      { id: "transit.line.freq.headway" },
                      { minutes: band.headwayMin },
                    )}
                  </summary>
                </details>
                <span className="freq-strip__caption freq-strip__caption--headway freq-strip__caption--desktop">
                  {intl.formatMessage(
                    { id: "transit.line.freq.headway" },
                    { minutes: band.headwayMin },
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SparseDay({ band }: { band: FrequencyBand }) {
  const intl = useIntl();
  const times = band.tripTimes ?? [];
  const joined = times.join(", ");
  return (
    <>
      <p className="visually-hidden">
        {intl.formatMessage(
          { id: "transit.line.freq.sparseSr" },
          { count: times.length, times: joined },
        )}
      </p>
      <p className="freq-strip__sparse" data-testid="freq-strip-sparse">
        <FormattedMessage
          id="transit.line.freq.sparseHeading"
          values={{ times: joined }}
        />
      </p>
    </>
  );
}
