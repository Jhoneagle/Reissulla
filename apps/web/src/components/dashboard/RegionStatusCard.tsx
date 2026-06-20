import { FormattedMessage, useIntl } from "react-intl";
import { isDisruption, type Alert } from "@reissulla/shared";
import { useLiveAlerts } from "../../hooks/useAlerts";
import { usePreferences } from "../../hooks/usePreferences";
import "./RegionStatusCard.css";

/**
 * LIVE-7 — per-region service-health matrix. Built over the app's real
 * transit feeds (HSL / Waltti / VäRELY); Waltti rolls up its member cities
 * (Tampere/Nysse, Turku/Föli, …) by gtfsId prefix, mirroring the server's
 * dispatch map. Each pill carries all three of a status glyph, a colour, and
 * a text label with the count, so it never relies on colour alone (WCAG
 * 1.4.1). Renders only when at least one alert applies to a feed.
 */

type RegionKey = "hsl" | "waltti" | "varely";
const REGION_KEYS: RegionKey[] = ["hsl", "waltti", "varely"];

// Mirrors apps/api/src/adapters/digitransit-routing/dispatch.ts prefix sets.
const REGION_PREFIXES: Record<RegionKey, string[]> = {
  hsl: ["HSL", "HSLlautta"],
  waltti: [
    "Raasepori",
    "LINKKI",
    "Mikkeli",
    "tampere",
    "Hameenlinna",
    "FOLI",
    "OULU",
    "FUNI",
    "Rovaniemi",
    "Vaasa",
    "Pori",
    "Kuopio",
    "Kajaani",
    "Kotka",
    "Lahti",
    "Salo",
    "Kouvola",
    "Lappeenranta",
    "Joensuu",
  ],
  varely: ["VARELY", "Rauma"],
};

type RegionHealth = "normal" | "moderated" | "no-service";
const STATUS_GLYPH: Record<RegionHealth, string> = {
  normal: "✓",
  moderated: "!",
  "no-service": "✕",
};

function regionKeyForAlert(alert: Alert): RegionKey | null {
  const gtfsId =
    alert.scope.kind === "route" || alert.scope.kind === "stop"
      ? alert.scope.gtfsId
      : undefined;
  if (!gtfsId) return null;
  const prefix = gtfsId.split(":")[0] ?? "";
  for (const key of REGION_KEYS) {
    if (REGION_PREFIXES[key].includes(prefix)) return key;
  }
  return null;
}

function healthFor(alerts: Alert[]): RegionHealth {
  if (alerts.some((a) => a.effect === "NO_SERVICE")) return "no-service";
  if (alerts.length > 0) return "moderated";
  return "normal";
}

export function RegionStatusCard(): React.JSX.Element | null {
  const intl = useIntl();
  const prefs = usePreferences();
  const { alerts } = useLiveAlerts();

  const byRegion = new Map<RegionKey, Alert[]>(
    REGION_KEYS.map((k) => [k, [] as Alert[]]),
  );
  for (const alert of alerts) {
    if (alert.source !== "digitransit") continue;
    // Count service-affecting disruptions only — info notices don't degrade a
    // region's health, and counting them produced alarming "364 disruptions".
    if (!isDisruption(alert)) continue;
    const key = regionKeyForAlert(alert);
    if (key) byRegion.get(key)!.push(alert);
  }

  const totalInScope = REGION_KEYS.reduce(
    (n, k) => n + byRegion.get(k)!.length,
    0,
  );
  if (totalInScope === 0) return null;

  const region = prefs.data?.transitRegion;
  const visibleKeys =
    region && region !== "all" && (REGION_KEYS as string[]).includes(region)
      ? [region as RegionKey]
      : REGION_KEYS;

  return (
    <section
      className="region-status-card"
      aria-label={intl.formatMessage({ id: "alert.region.status.title" })}
    >
      <h2 className="region-status-card__title">
        <FormattedMessage id="alert.region.status.title" />
      </h2>
      <ul className="region-status-card__pills">
        {visibleKeys.map((key) => {
          const regionAlerts = byRegion.get(key)!;
          const health = healthFor(regionAlerts);
          const label = intl.formatMessage(
            { id: `alert.region.status.${health}` },
            {
              region: intl.formatMessage({ id: `alert.region.name.${key}` }),
              count: regionAlerts.length,
            },
          );
          return (
            <li key={key} className={`region-pill region-pill--${health}`}>
              <span className="region-pill__glyph" aria-hidden="true">
                {STATUS_GLYPH[health]}
              </span>
              <span className="region-pill__label">{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
