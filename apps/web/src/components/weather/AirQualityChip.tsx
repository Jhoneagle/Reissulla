import { FormattedMessage, useIntl } from "react-intl";
import type { AirQualitySnapshot, PollenSnapshot } from "@reissulla/shared";

interface AirQualityChipProps {
  airQuality: AirQualitySnapshot | null | undefined;
  pollen: PollenSnapshot | null | undefined;
}

/**
 * European AQI bands per the EEA — Good / Fair / Moderate / Poor /
 * Very Poor / Extremely Poor. We collapse the upper two into "very
 * poor" because the visual chip can't carry a six-state palette
 * cleanly and the public health advice merges them in practice.
 */
type AqiBucket = "good" | "fair" | "moderate" | "poor" | "very-poor";

function aqiBucket(aqi: number): AqiBucket {
  if (aqi <= 20) return "good";
  if (aqi <= 40) return "fair";
  if (aqi <= 60) return "moderate";
  if (aqi <= 80) return "poor";
  return "very-poor";
}

/**
 * Open-Meteo publishes grain counts but no canonical "elevated"
 * threshold; the upstream documentation uses 50 grains/m³ as the
 * point where sensitive individuals notice symptoms across most
 * European taxa. We use the same cut so the sub-line stays quiet
 * outside the Finnish allergy season.
 */
const POLLEN_ELEVATED = 50;

interface PollenLine {
  /** i18n suffix — `weather.aq.pollen.tree`, `.grass`, `.mugwort`. */
  taxon: "tree" | "grass" | "mugwort" | "olive" | "ragweed";
}

function elevatedTaxa(pollen: PollenSnapshot | null | undefined): PollenLine[] {
  if (!pollen) return [];
  const out: PollenLine[] = [];
  // Alder + birch collapse into "tree pollen" — both are the dominant
  // tree allergens in Finland and the relevant advice is identical.
  const tree = Math.max(pollen.alder ?? 0, pollen.birch ?? 0);
  if (tree >= POLLEN_ELEVATED) out.push({ taxon: "tree" });
  if ((pollen.grass ?? 0) >= POLLEN_ELEVATED) out.push({ taxon: "grass" });
  if ((pollen.mugwort ?? 0) >= POLLEN_ELEVATED) out.push({ taxon: "mugwort" });
  // Olive and ragweed are rare in Finland — only mention when present.
  if ((pollen.olive ?? 0) >= POLLEN_ELEVATED) out.push({ taxon: "olive" });
  if ((pollen.ragweed ?? 0) >= POLLEN_ELEVATED) out.push({ taxon: "ragweed" });
  return out;
}

export function AirQualityChip({ airQuality, pollen }: AirQualityChipProps) {
  const intl = useIntl();
  if (!airQuality) return null;
  const bucket = aqiBucket(airQuality.europeanAqi);
  const taxa = elevatedTaxa(pollen);

  return (
    <section
      className={`aq-chip aq-chip--${bucket}`}
      aria-label={intl.formatMessage({ id: "weather.aq.label" })}
    >
      <div className="aq-chip__row">
        <span className="aq-chip__aqi">
          {Math.round(airQuality.europeanAqi)}
        </span>
        <span className="aq-chip__bucket">
          <FormattedMessage id={`weather.aq.bucket.${bucket}`} />
        </span>
      </div>
      {taxa.length > 0 && (
        <p className="aq-chip__pollen">
          <FormattedMessage id="weather.aq.pollen.heading" />{" "}
          {taxa.map((t, i) => (
            <span key={t.taxon}>
              <FormattedMessage id={`weather.aq.pollen.${t.taxon}`} />
              {i < taxa.length - 1 && (
                <span aria-hidden="true">
                  {intl.formatMessage({ id: "weather.aq.pollen.separator" })}
                </span>
              )}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
