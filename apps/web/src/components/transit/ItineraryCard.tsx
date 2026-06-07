import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { TransitItinerary } from "@reissulla/shared";
import {
  formatDepartureTime,
  formatDuration,
  formatWalkDistance,
} from "../../lib/transit-utils";
import { ItineraryLeg } from "./ItineraryLeg";
import { ItineraryWeatherStrip } from "./ItineraryWeatherStrip";

const RIGHT_ARROW = "→";

interface ItineraryCardProps {
  itinerary: TransitItinerary;
  index: number;
}

function buildShareUrl(itinerary: TransitItinerary): string {
  const first = itinerary.legs.at(0);
  const last = itinerary.legs.at(-1);
  if (!first || !last) return "";
  const params = new URLSearchParams({
    from: `${first.from.lat},${first.from.lon}`,
    to: `${last.to.lat},${last.to.lon}`,
    at: String(Math.floor(itinerary.startTime / 1000)),
    mode: "fastest",
  });
  return `/t#${params.toString()}`;
}

export function ItineraryCard({ itinerary, index }: ItineraryCardProps) {
  const intl = useIntl();
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const transfersLabel = intl.formatMessage(
    { id: "transit.itinerary.transfers" },
    { n: itinerary.transfers },
  );

  const sharePath = buildShareUrl(itinerary);
  const shareUrl =
    typeof window !== "undefined" && sharePath
      ? `${window.location.origin}${sharePath}`
      : sharePath;

  async function handleShare() {
    if (!shareUrl) return;
    const title = intl.formatMessage(
      { id: "transit.itinerary.share.title" },
      { n: index + 1 },
    );
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch {
        // User cancelled or share unsupported — fall through to clipboard.
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("copied");
        window.setTimeout(() => setShareStatus("idle"), 2500);
      } catch {
        // Clipboard write blocked — keep the surface quiet.
      }
    }
  }

  return (
    <article className="itinerary-card">
      <header className="itinerary-card__header">
        <span className="itinerary-card__label">
          <FormattedMessage
            id="transit.itinerary.option"
            values={{ n: index + 1 }}
          />
        </span>
        <div className="itinerary-card__times">
          <span className="itinerary-card__time">
            {formatDepartureTime(itinerary.startTime)}
          </span>
          <span className="itinerary-card__arrow" aria-hidden="true">
            {RIGHT_ARROW}
          </span>
          <span className="itinerary-card__time">
            {formatDepartureTime(itinerary.endTime)}
          </span>
        </div>
        <div className="itinerary-card__meta">
          <span>{formatDuration(itinerary.duration)}</span>
          <span aria-label={transfersLabel}>
            {itinerary.transfers === 0 ? (
              <FormattedMessage id="transit.itinerary.direct" />
            ) : (
              transfersLabel
            )}
          </span>
          {itinerary.walkDistance > 0 && (
            <span>
              <FormattedMessage
                id="transit.itinerary.walkSuffix"
                values={{
                  distance: formatWalkDistance(itinerary.walkDistance),
                }}
              />
            </span>
          )}
        </div>
        {itinerary.farePlaceholders && (
          <p className="itinerary-card__fare-placeholder">
            <FormattedMessage id="transit.itinerary.farePlaceholder" />
          </p>
        )}
      </header>
      <div className="itinerary-card__legs">
        {itinerary.legs.map((leg, i) => (
          <ItineraryLeg key={`${leg.mode}-${leg.startTime}-${i}`} leg={leg} />
        ))}
      </div>
      <ItineraryWeatherStrip itinerary={itinerary} />
      {sharePath && (
        <div className="itinerary-card__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleShare}
            aria-live="polite"
          >
            {shareStatus === "copied" ? (
              <FormattedMessage id="transit.itinerary.share.copied" />
            ) : (
              <FormattedMessage id="transit.itinerary.share.label" />
            )}
          </button>
        </div>
      )}
    </article>
  );
}
