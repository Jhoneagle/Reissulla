import type { AdapterContext } from "../types.js";
import {
  createFintrafficClient,
  type FintrafficClient,
} from "./client.js";
import {
  mapSurfaceState,
  type FintrafficRawSection,
  type RoadCondition,
} from "./types.js";

/**
 * Fintraffic adapter — wraps the Digitraffic Road API to return current
 * road-surface conditions near a coordinate. The composition service uses
 * the surface state to add a walking-time penalty when the road surface is
 * icy / partly-icy / frosty.
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function nearestSection(
  sections: readonly FintrafficRawSection[],
  lat: number,
  lon: number,
): { section: FintrafficRawSection; distanceKm: number } | null {
  let best: { section: FintrafficRawSection; distanceKm: number } | null = null;
  for (const section of sections) {
    const distanceKm = haversineKm(
      lat,
      lon,
      section.coordinates.latitude,
      section.coordinates.longitude,
    );
    if (best === null || distanceKm < best.distanceKm) {
      best = { section, distanceKm };
    }
  }
  return best;
}

export interface FintrafficAdapter {
  readonly source: "fintraffic";
  readonly baseUrl: string;
  getRoadConditions(
    lat: number,
    lon: number,
    ctx: AdapterContext,
  ): Promise<RoadCondition | null>;
}

function buildAdapter(client: FintrafficClient): FintrafficAdapter {
  return {
    source: "fintraffic",
    baseUrl: client.baseUrl,

    async getRoadConditions(lat, lon, ctx) {
      const raw = await client.fetchRoadConditions(ctx);
      if (raw.weatherData.length === 0) return null;

      const nearest = nearestSection(raw.weatherData, lat, lon);
      if (nearest === null) return null;

      const current = nearest.section.forecast[0];
      if (current === undefined) return null;

      return {
        sectionId: nearest.section.id,
        sectionName: nearest.section.sectionName,
        surfaceState: mapSurfaceState(current.roadCondition),
        weather: current.weather,
        roadTemperature: current.roadTemperature,
        distanceKm: nearest.distanceKm,
        observedAt: raw.dataUpdatedTime,
      };
    },
  };
}

export const fintrafficAdapter: FintrafficAdapter = buildAdapter(
  createFintrafficClient(),
);
