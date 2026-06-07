import { FormattedMessage, useIntl } from "react-intl";
import type { RainNowcast as RainNowcastData } from "@reissulla/shared";
import { useNowcast } from "../../hooks/useNowcast";
import { useThrottledText } from "../../hooks/useThrottledText";

interface RainNowcastProps {
  lat: number | null;
  lon: number | null;
}

/**
 * Accessible rain / snow nowcast — text + polite live region under the
 * dashboard primary card. The server pre-renders fi + en copy so this
 * component picks by locale and never templates client-side. A 15 s
 * throttle (via `useThrottledText`) coalesces fast cache-miss /
 * cache-hit flips into one announcement; the visible DOM text mirrors
 * the throttled value so sighted users see what the screen reader
 * announces. Nothing renders when the upstream returns `null` (no rain
 * / no snow within window).
 *
 * The minimum-gap policy matches design-system §9 SC 2.2.2 latitude on
 * non-critical live regions (warnings have their own assertive channel).
 */

const ANNOUNCE_THROTTLE_MS = 15_000;

function pickText(data: RainNowcastData, locale: "fi" | "en"): string {
  return locale === "fi" ? data.textFi : data.textEn;
}

export function RainNowcast({ lat, lon }: RainNowcastProps) {
  const intl = useIntl();
  const { data } = useNowcast(lat, lon);
  const locale: "fi" | "en" = intl.locale.startsWith("fi") ? "fi" : "en";

  const nowcast = data?.data ?? null;
  const incomingText = nowcast ? pickText(nowcast, locale) : "";
  const throttled = useThrottledText(incomingText, ANNOUNCE_THROTTLE_MS);

  if (!nowcast || throttled.length === 0) return null;

  return (
    <section
      className={`rain-nowcast rain-nowcast--${nowcast.flavor}`}
      data-state={nowcast.state}
      aria-labelledby="rain-nowcast-heading"
    >
      <h4 id="rain-nowcast-heading" className="visually-hidden">
        <FormattedMessage id="weather.nowcast.heading" />
      </h4>
      <p className="rain-nowcast__text" role="status" aria-live="polite">
        {throttled}
      </p>
    </section>
  );
}
