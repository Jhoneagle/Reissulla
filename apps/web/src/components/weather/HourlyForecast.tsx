import { useEffect, useId, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { HourlyForecast as Hour } from "@reissulla/shared";

interface HourlyForecastProps {
  hours: Hour[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * The graph shows 24 hours; the table covers the full 48-hour band.
 * Render windowing keeps the SVG legible on a 360 px phone while still
 * scaling cleanly to a desktop card. The accessible table picks up the
 * extended-range case so we don't trade off mobile readability for a
 * 1500-pixel scroll strip nobody can actually read.
 */
const GRAPH_HOURS = 24;
const TABLE_HOURS = 48;

type DisplayMode = "graph" | "table";

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduce(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduce;
}

/** Pick the first hour at-or-after now from upstream's local-zoned list. */
function firstFutureIndex(hours: Hour[]): number {
  const nowIso = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  for (let i = 0; i < hours.length; i++) {
    if (hours[i]!.time.slice(0, 13) >= nowIso) return i;
  }
  return 0;
}

function hourLabel(iso: string): string {
  return iso.slice(11, 16); // "HH:mm" from upstream's local clock
}

export function HourlyForecast({
  hours,
  isLoading,
  isError,
}: HourlyForecastProps) {
  const intl = useIntl();
  const reduceMotion = useReduceMotion();
  const headingId = useId();
  // reduce-motion drives first paint; the manual toggle takes over once
  // the user expresses a preference within the session.
  const [mode, setMode] = useState<DisplayMode | null>(null);
  const effectiveMode: DisplayMode = mode ?? (reduceMotion ? "table" : "graph");

  const { graphHours, tableHours } = useMemo(() => {
    if (!hours?.length) return { graphHours: [], tableHours: [] };
    const start = firstFutureIndex(hours);
    return {
      graphHours: hours.slice(start, start + GRAPH_HOURS),
      tableHours: hours.slice(start, start + TABLE_HOURS),
    };
  }, [hours]);

  if (isLoading) {
    return (
      <section
        className="hourly hourly--loading"
        aria-label={intl.formatMessage({ id: "weather.hourly.loading" })}
      >
        <div className="skel skel-hourly" />
      </section>
    );
  }

  if (isError || graphHours.length === 0) return null;

  return (
    <section className="hourly" aria-labelledby={headingId}>
      <header className="hourly__header">
        <h3 id={headingId} className="hourly__heading">
          <FormattedMessage id="weather.hourly.heading" />
        </h3>
        <button
          type="button"
          className="hourly__toggle"
          aria-pressed={effectiveMode === "table"}
          onClick={() => setMode(effectiveMode === "graph" ? "table" : "graph")}
        >
          <FormattedMessage
            id={
              effectiveMode === "graph"
                ? "weather.hourly.toggle.toTable"
                : "weather.hourly.toggle.toGraph"
            }
          />
        </button>
      </header>
      {effectiveMode === "graph" ? (
        <HourlyGraph hours={graphHours} />
      ) : (
        <HourlyTable hours={tableHours} />
      )}
    </section>
  );
}

/**
 * SVG bar graph — no chart library. The SVG is sized via `viewBox` and
 * `width="100%"` so it scales to whatever the parent grid cell offers.
 * Column geometry stays in viewBox coordinates: every label, dot, and
 * bar gets the same proportional shrink on a 360 px phone as on a
 * 1100 px desktop card.
 */
function HourlyGraph({ hours }: { hours: Hour[] }) {
  const intl = useIntl();
  const colWidth = 32;
  const rowHeight = 96;
  const tempBaseline = 60;
  const tempScale = 2; // viewBox units per °C
  const temps = hours.map((h) => h.temperature);
  const tMin = Math.min(...temps, 0);
  const tMax = Math.max(...temps, 5);
  // Centre the temperature line on the band's midpoint so the curve
  // visually lifts and dips evenly even when readings sit far from zero.
  const midpoint = (tMin + tMax) / 2;
  const projectY = (t: number) => tempBaseline - (t - midpoint) * tempScale;

  const width = colWidth * hours.length;

  const pointsPath = hours
    .map(
      (h, i) =>
        `${i === 0 ? "M" : "L"} ${i * colWidth + colWidth / 2} ${projectY(h.temperature)}`,
    )
    .join(" ");

  return (
    <svg
      className="hourly__graph"
      width="100%"
      height={rowHeight}
      viewBox={`0 0 ${width} ${rowHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={intl.formatMessage(
        { id: "weather.hourly.graphSummary" },
        { count: hours.length, min: Math.round(tMin), max: Math.round(tMax) },
      )}
    >
      {hours.map((h, i) => {
        const x = i * colWidth;
        const pp = h.precipitationProbability ?? 0;
        const ppHeight = (pp / 100) * 32;
        return (
          <g key={h.time}>
            {pp > 0 && (
              <rect
                className="hourly__precip"
                x={x + 4}
                y={rowHeight - 16 - ppHeight}
                width={colWidth - 8}
                height={ppHeight}
              />
            )}
            <text
              className="hourly__hour-label"
              x={x + colWidth / 2}
              y={rowHeight - 4}
              textAnchor="middle"
            >
              {hourLabel(h.time)}
            </text>
          </g>
        );
      })}
      <path className="hourly__temp-line" d={pointsPath} fill="none" />
      {hours.map((h, i) => (
        <g key={`pt-${h.time}`}>
          <circle
            className="hourly__temp-dot"
            cx={i * colWidth + colWidth / 2}
            cy={projectY(h.temperature)}
            r={2.5}
          />
          <text
            className="hourly__temp-label"
            x={i * colWidth + colWidth / 2}
            y={projectY(h.temperature) - 6}
            textAnchor="middle"
          >
            {Math.round(h.temperature)}°
          </text>
        </g>
      ))}
    </svg>
  );
}

function HourlyTable({ hours }: { hours: Hour[] }) {
  const intl = useIntl();
  return (
    <div className="hourly__table-scroller">
      <table
        className="hourly__table"
        aria-label={intl.formatMessage({ id: "weather.hourly.tableLabel" })}
      >
        <caption className="visually-hidden">
          <FormattedMessage id="weather.hourly.tableCaption" />
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <FormattedMessage id="weather.hourly.col.time" />
            </th>
            <th scope="col">
              <FormattedMessage id="weather.hourly.col.temp" />
            </th>
            <th scope="col">
              <FormattedMessage id="weather.hourly.col.precip" />
            </th>
            <th scope="col">
              <FormattedMessage id="weather.hourly.col.wind" />
            </th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h.time}>
              <th scope="row">{hourLabel(h.time)}</th>
              <td>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {Math.round(h.temperature)}°
              </td>
              <td>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {h.precipitationProbability}%
              </td>
              <td>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {Math.round(h.windSpeed)} m/s
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
