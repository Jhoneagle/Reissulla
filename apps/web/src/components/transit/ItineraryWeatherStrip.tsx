import { FormattedMessage, useIntl } from "react-intl";
import type { TransitItinerary } from "@reissulla/shared";
import { formatDepartureTime } from "../../lib/transit-utils";
import { WeatherIcon } from "../weather/WeatherIcon";

interface ItineraryWeatherStripProps {
  itinerary: TransitItinerary;
}

function legBoardingPlace(
  itinerary: TransitItinerary,
  legIndex: number,
): string {
  return itinerary.legs[legIndex]?.from.name ?? "";
}

/**
 * Itinerary-weather disclosure. Collapsed by default — the summary line
 * carries the pre-trip lede ("17 °C at depart, 14 °C at arrival") so a
 * skim-reader gets the gist without expanding. Opening the `<details>`
 * shows origin + destination rows and any outdoor-wait notes the planner
 * surfaced (gap > 5 min between legs).
 *
 * The container declares `aria-live="off"` explicitly — the planner UI
 * only re-renders the strip on user action (re-planning), so an SR
 * shouldn't re-announce on prop changes.
 */
export function ItineraryWeatherStrip({
  itinerary,
}: ItineraryWeatherStripProps) {
  const intl = useIntl();
  const weather = itinerary.weather;
  if (!weather) return null;

  const origin = weather.originWeather;
  const destination = weather.destinationWeather;
  const waits = weather.legOutdoorWaits.filter((w) => w.outdoorWaitMin > 5);

  if (!origin && !destination && waits.length === 0) {
    return null;
  }

  const summaryParts: string[] = [];
  if (origin) {
    summaryParts.push(
      intl.formatMessage(
        { id: "transit.itinerary.weather.summaryOrigin" },
        {
          temperature: Math.round(origin.temperature),
          weather: origin.weatherDescription,
        },
      ),
    );
  }
  if (destination) {
    summaryParts.push(
      intl.formatMessage(
        { id: "transit.itinerary.weather.summaryDestination" },
        {
          temperature: Math.round(destination.temperature),
          weather: destination.weatherDescription,
        },
      ),
    );
  }
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : intl.formatMessage({ id: "transit.itinerary.weather.unavailable" });

  return (
    <details className="itinerary-weather" aria-live="off">
      <summary className="itinerary-weather__summary">
        <span className="itinerary-weather__kicker">
          <FormattedMessage id="transit.itinerary.weather.kicker" />
        </span>
        <span className="itinerary-weather__lede">{summary}</span>
      </summary>
      <dl className="itinerary-weather__list">
        {origin && (
          <div className="itinerary-weather__row">
            <dt className="itinerary-weather__label">
              <FormattedMessage
                id="transit.itinerary.weather.originLabel"
                values={{ time: formatDepartureTime(itinerary.startTime) }}
              />
            </dt>
            <dd className="itinerary-weather__value">
              <WeatherIcon
                code={origin.weatherCode}
                isDay={true}
                size={18}
                className="itinerary-weather__icon"
              />
              <span className="itinerary-weather__temperature">
                <FormattedMessage
                  id="transit.itinerary.weather.temperatureValue"
                  values={{ temperature: Math.round(origin.temperature) }}
                />
              </span>
              <span className="itinerary-weather__description">
                {origin.weatherDescription}
              </span>
            </dd>
          </div>
        )}
        {destination && (
          <div className="itinerary-weather__row">
            <dt className="itinerary-weather__label">
              <FormattedMessage
                id="transit.itinerary.weather.destinationLabel"
                values={{ time: formatDepartureTime(itinerary.endTime) }}
              />
            </dt>
            <dd className="itinerary-weather__value">
              <WeatherIcon
                code={destination.weatherCode}
                isDay={true}
                size={18}
                className="itinerary-weather__icon"
              />
              <span className="itinerary-weather__temperature">
                <FormattedMessage
                  id="transit.itinerary.weather.temperatureValue"
                  values={{ temperature: Math.round(destination.temperature) }}
                />
              </span>
              <span className="itinerary-weather__description">
                {destination.weatherDescription}
              </span>
            </dd>
          </div>
        )}
        {waits.map((wait) => (
          <div
            className="itinerary-weather__row itinerary-weather__row--wait"
            key={wait.legIndex}
          >
            <dt className="itinerary-weather__label">
              <FormattedMessage
                id="transit.itinerary.weather.outdoorWaitLabel"
                values={{ place: legBoardingPlace(itinerary, wait.legIndex) }}
              />
            </dt>
            <dd className="itinerary-weather__value">
              <span className="itinerary-weather__wait-chip">
                <FormattedMessage
                  id="transit.itinerary.weather.outdoorWaitChip"
                  values={{ minutes: wait.outdoorWaitMin }}
                />
              </span>
              {wait.weather && (
                <span className="itinerary-weather__description">
                  {wait.weather.weatherDescription}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
