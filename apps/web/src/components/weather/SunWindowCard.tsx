import { FormattedMessage, useIntl } from "react-intl";
import type { DailyForecast } from "@reissulla/shared";

interface SunWindowCardProps {
  /** Daily array from snapshot.forecast — we read index 0 (today). */
  daily: DailyForecast[] | undefined;
}

function formatClock(iso: string): string {
  // Open-Meteo returns sunrise/sunset as ISO strings already in the
  // requested timezone. Slice the time-of-day directly so we don't
  // accidentally re-shift to the browser's local zone.
  return iso.slice(11, 16);
}

function formatDuration(minutes: number): { h: number; m: number } {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return { h, m };
}

export function SunWindowCard({ daily }: SunWindowCardProps) {
  const intl = useIntl();
  const today = daily?.[0];
  if (!today) return null;

  const sunriseMs = new Date(today.sunrise).getTime();
  const sunsetMs = new Date(today.sunset).getTime();
  const daylightMin = (sunsetMs - sunriseMs) / 60_000;
  const { h, m } = formatDuration(daylightMin);

  return (
    <section
      className="sun-window"
      aria-label={intl.formatMessage({ id: "weather.sun.label" })}
    >
      <div className="sun-window__row">
        <div className="sun-window__item">
          <span className="sun-window__icon" aria-hidden="true">
            <SunriseIcon />
          </span>
          <div>
            <span className="sun-window__label">
              <FormattedMessage id="weather.sun.sunrise" />
            </span>
            <span className="sun-window__time">
              {formatClock(today.sunrise)}
            </span>
          </div>
        </div>
        <div className="sun-window__item">
          <span className="sun-window__icon" aria-hidden="true">
            <SunsetIcon />
          </span>
          <div>
            <span className="sun-window__label">
              <FormattedMessage id="weather.sun.sunset" />
            </span>
            <span className="sun-window__time">
              {formatClock(today.sunset)}
            </span>
          </div>
        </div>
      </div>
      <p className="sun-window__daylight">
        <FormattedMessage
          id="weather.sun.daylight"
          values={{ hours: h, minutes: m }}
        />
      </p>
    </section>
  );
}

function SunriseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 18a5 5 0 0 0-10 0" />
      <line x1="12" y1="2" x2="12" y2="9" />
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
      <line x1="1" y1="18" x2="3" y2="18" />
      <line x1="21" y1="18" x2="23" y2="18" />
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
      <line x1="23" y1="22" x2="1" y2="22" />
      <polyline points="8 6 12 2 16 6" />
    </svg>
  );
}

function SunsetIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 18a5 5 0 0 0-10 0" />
      <line x1="12" y1="9" x2="12" y2="2" />
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
      <line x1="1" y1="18" x2="3" y2="18" />
      <line x1="21" y1="18" x2="23" y2="18" />
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
      <line x1="23" y1="22" x2="1" y2="22" />
      <polyline points="16 5 12 9 8 5" />
    </svg>
  );
}
