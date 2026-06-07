import { cacheGet, cacheSet } from "../../cache/cache.js";
import { cacheKey } from "../../cache/key.js";
import {
  WEATHER_RADAR_TILES_TTL,
  WEATHER_NOWCAST_TTL,
} from "../../cache/ttl.js";
import { tryCache } from "../../utils/resilience.js";
import { fmiAdapter, type RadarFrame } from "../../adapters/fmi/index.js";
import { config } from "../../config.js";
import type { AdapterContext, AdapterLocale } from "../../adapters/types.js";

/**
 * Radar-side helpers for the map overlay and the tile proxy.
 *
 * Two distinct caches:
 *  - `weather:radar-tiles:v1:<bucket>` — the sliding frame list (~12 frames
 *    of timestamps + tile URL templates). Bucketed at 60 s so concurrent
 *    callers within the same window share one upstream fan-out.
 *  - `weather:radar-image:v1:<ts>:<z>:<x>:<y>` — base64-encoded tile bytes
 *    fronted by the proxy endpoint. base64 keeps the bytes JSON-safe so the
 *    existing `cacheSet` wrapper (which JSON.stringify's everything) doesn't
 *    mangle the binary. 60 s TTL matches the frame cadence — a fresh frame
 *    every minute always supersedes stale image bytes.
 */

const TILE_FETCH_TIMEOUT_MS = 8_000;

export interface RadarTimelineResult {
  frames: RadarFrame[];
  cached: boolean;
}

export async function getRadarTimeline(opts: {
  minutesBack: number;
  ctx: AdapterContext;
}): Promise<RadarTimelineResult> {
  const bucket =
    Math.floor(Date.now() / 1000 / WEATHER_NOWCAST_TTL) * WEATHER_NOWCAST_TTL;
  const key = cacheKey(
    "weather",
    "radar-tiles",
    1,
    String(opts.minutesBack),
    String(bucket),
  );

  const hit = await tryCache(() => cacheGet<RadarFrame[]>(key));
  if (hit !== null) return { frames: hit, cached: true };

  const frames = await fmiAdapter.getRadarTimeline(
    { minutesBack: opts.minutesBack },
    opts.ctx,
  );
  await tryCache(() => cacheSet(key, frames, WEATHER_RADAR_TILES_TTL));
  return { frames, cached: false };
}

export interface RadarTileBytesResult {
  bytes: Uint8Array;
  contentType: string;
  cached: boolean;
}

/**
 * Fetch + cache a single FMI radar tile. The browser will also HTTP-cache
 * the response for the TTL window via `Cache-Control: public, max-age=60`,
 * so the Redis layer mostly deduplicates concurrent first-loads across
 * users. Cache misses fall back to a fresh upstream fetch with our
 * configured User-Agent.
 */
export async function getRadarTileBytes(opts: {
  timestamp: number;
  z: number;
  x: number;
  y: number;
  signal?: AbortSignal;
}): Promise<RadarTileBytesResult> {
  const key = cacheKey(
    "weather",
    "radar-image",
    1,
    String(opts.timestamp),
    `${opts.z}-${opts.x}-${opts.y}`,
  );

  const hit = await tryCache(() => cacheGet<string>(key));
  if (hit !== null) {
    return {
      bytes: new Uint8Array(Buffer.from(hit, "base64")),
      contentType: "image/png",
      cached: true,
    };
  }

  const url = fmiAdapter.getRadarTileUrl({
    z: opts.z,
    x: opts.x,
    y: opts.y,
    timestamp: opts.timestamp,
  });

  const timeoutSignal = AbortSignal.timeout(TILE_FETCH_TIMEOUT_MS);
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutSignal])
    : timeoutSignal;

  const res = await fetch(url, {
    headers: { "User-Agent": config.fmiUserAgent },
    signal,
  });
  if (!res.ok) {
    throw new Error(`FMI radar tile HTTP ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const b64 = Buffer.from(buf).toString("base64");
  await tryCache(() => cacheSet(key, b64, WEATHER_RADAR_TILES_TTL));
  return {
    bytes: buf,
    contentType: res.headers.get("content-type") ?? "image/png",
    cached: false,
  };
}

// `locale` is unused today but reserved on the signature so a future
// localized radar legend (e.g. snow/rain colour key) can ride this path
// without breaking callers.
export type { AdapterLocale };
