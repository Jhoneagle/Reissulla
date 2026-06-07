import { TileLayer } from "react-leaflet";
import type { NowcastFlavor } from "@reissulla/shared";
import { useMapStore } from "../../stores/map";
import { useHighContrast } from "../../hooks/useHighContrast";
import { useRadarTimeline } from "../../hooks/useRadarTimeline";

/**
 * FMI radar overlay. The active frame's tile URL points at the API proxy
 * (`/api/v1/weather/radar/:ts/:z/:x/:y.png`) rather than the FMI host
 * directly — the proxy adds our user-agent and caches the bytes for 60 s
 * so concurrent viewers deduplicate at the cache. Under high-contrast
 * the overlay returns null; the dashboard `RainNowcast` text is the
 * modality those users see.
 *
 * The cycle driver lives in `useRadarTimeline` so `<RadarControls>` and
 * this component read the same active-frame state.
 */
const API_BASE = "/api/v1";

function proxiedTileUrl(timestamp: number): string {
  return `${API_BASE}/weather/radar/${timestamp}/{z}/{x}/{y}.png`;
}

interface RainRadarOverlayProps {
  /**
   * Drives the rain-vs-snow tint via CSS filter tokens. Omitting it
   * falls back to the rain ramp — fine when the upstream snapshot
   * hasn't loaded yet.
   */
  flavor?: NowcastFlavor;
}

export function RainRadarOverlay({ flavor }: RainRadarOverlayProps) {
  const visible = useMapStore((s) => s.overlays.has("overlay-rain-radar"));
  const highContrast = useHighContrast();
  const { frames, currentIdx } = useRadarTimeline(visible && !highContrast);

  if (!visible || highContrast) return null;
  if (frames.length === 0) return null;

  const frame = frames[currentIdx] ?? frames[frames.length - 1];
  if (!frame) return null;

  const className =
    flavor === "snow" ? "radar-tile radar-tile--snow" : "radar-tile";

  return (
    <TileLayer
      url={proxiedTileUrl(frame.timestamp)}
      opacity={0.65}
      className={className}
      attribution="&copy; FMI"
    />
  );
}
