import { useIntl, type IntlShape } from "react-intl";

/**
 * Locale-aware lookup for a WMO weather code description.
 *
 * The wire shape (Open-Meteo via the adapter) ships a hardcoded English
 * `weatherDescription` string alongside the numeric `weatherCode`. UI
 * surfaces should never read the wire string directly — call this helper
 * with the code and let i18n resolve the label. Missing codes fall back
 * to `weather.wmo.unknown` so a future Open-Meteo schema change can't
 * crash the dashboard with `undefined`.
 *
 * Two flavours:
 * - `useWeatherDescription(code)` — React hook for component bodies.
 * - `formatWeatherCode(intl, code)` — call-site variant for `useMemo`
 *   loops where invoking a hook per item would violate the rules of
 *   hooks.
 */

export function formatWeatherCode(intl: IntlShape, code: number): string {
  const unknown = intl.formatMessage({ id: "weather.code.unknown" });
  return intl.formatMessage({
    id: `weather.code.${code}`,
    defaultMessage: unknown,
  });
}

export function useWeatherDescription(code: number): string {
  const intl = useIntl();
  return formatWeatherCode(intl, code);
}
