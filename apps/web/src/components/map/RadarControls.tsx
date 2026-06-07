import { FormattedMessage, useIntl } from "react-intl";
import { useMapStore } from "../../stores/map";
import { useHighContrast } from "../../hooks/useHighContrast";
import { useRadarTimeline } from "../../hooks/useRadarTimeline";
import "./RadarControls.css";

/**
 * Play / pause + step + frame timeline for the radar overlay. Mounted
 * only when the radar overlay is active and high-contrast isn't in
 * effect (the dashboard text nowcast is the HC modality). Under
 * reduce-motion the play/pause control is replaced with a `[← Step]
 * [Step →]` pair so SC 2.2.2's bound-on-idle-motion is honoured before
 * the user touches anything.
 *
 * The frame indicator under the buttons shows `–60m · –45m · … · now`
 * with the active frame highlighted in `--color-primary`; clicking any
 * marker jumps to that frame and pauses the cycle.
 */

function relativeMinutes(timestamp: number, latest: number): number {
  return Math.round((timestamp - latest) / 60);
}

export function RadarControls() {
  const intl = useIntl();
  const visible = useMapStore((s) => s.overlays.has("overlay-rain-radar"));
  const highContrast = useHighContrast();
  const radar = useRadarTimeline(visible && !highContrast);

  if (!visible || highContrast) return null;
  if (radar.frames.length === 0) return null;

  const latest = radar.frames[radar.frames.length - 1]?.timestamp ?? 0;
  const activeFrame = radar.frames[radar.currentIdx];

  return (
    <div
      className="radar-controls"
      role="group"
      aria-label={intl.formatMessage({ id: "map.radar.controls.label" })}
    >
      <div className="radar-controls__buttons">
        {radar.stepOnly ? (
          <>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => radar.step(-1)}
              aria-label={intl.formatMessage({ id: "map.radar.stepBack" })}
            >
              <FormattedMessage id="map.radar.stepBack.short" />
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => radar.step(1)}
              aria-label={intl.formatMessage({ id: "map.radar.stepForward" })}
            >
              <FormattedMessage id="map.radar.stepForward.short" />
            </button>
          </>
        ) : radar.isAnimating ? (
          <button
            type="button"
            className="btn btn--sm"
            onClick={radar.pause}
            aria-label={intl.formatMessage({ id: "map.radar.pause" })}
          >
            <FormattedMessage id="map.radar.pause.short" />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--sm"
            onClick={radar.play}
            aria-label={intl.formatMessage({ id: "map.radar.play" })}
          >
            <FormattedMessage id="map.radar.play.short" />
          </button>
        )}
        {radar.bounded && !radar.stepOnly && (
          <span className="radar-controls__hint" role="status">
            <FormattedMessage id="map.radar.bounded.hint" />
          </span>
        )}
      </div>

      <ol
        className="radar-controls__timeline"
        aria-label={intl.formatMessage({
          id: "map.radar.timeline.label",
        })}
      >
        {radar.frames.map((frame, idx) => {
          const rel = relativeMinutes(frame.timestamp, latest);
          const isActive = idx === radar.currentIdx;
          const label =
            rel === 0
              ? intl.formatMessage({ id: "map.radar.frame.now" })
              : intl.formatMessage(
                  { id: "map.radar.frame.minutesAgo" },
                  { minutes: Math.abs(rel) },
                );
          return (
            <li key={frame.timestamp}>
              <button
                type="button"
                className={`radar-controls__frame${
                  isActive ? " radar-controls__frame--active" : ""
                }`}
                aria-pressed={isActive}
                onClick={() => radar.jumpToFrame(idx)}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="radar-controls__active-frame" aria-live="polite">
        <FormattedMessage
          id="map.radar.frame.active"
          values={{
            minutes:
              activeFrame !== undefined
                ? Math.abs(relativeMinutes(activeFrame.timestamp, latest))
                : 0,
          }}
        />
      </p>
    </div>
  );
}
