import type { FastifyPluginAsync } from "fastify";
import type { TransitSubStop } from "@reissulla/shared";
import {
  getNearbyStops,
  getAdaptiveNearbyStops,
  searchStops,
  getStopDepartures,
  getMultiStopDepartures,
  planRoute,
} from "../services/transit/index.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";
import { parseJson } from "../utils/json.js";
import { requireAuth } from "../auth/middleware.js";
import { NotFoundError } from "../utils/error-envelope.js";
import * as pinnedStopsRepo from "../db/repositories/pinned-stops.repo.js";
import * as recentStopsRepo from "../db/repositories/recent-stops.repo.js";

function isSubStopArray(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value)) return false;
  return value.every((v) => typeof v === "object" && v !== null);
}

function coerceSubStop(raw: Record<string, unknown>): TransitSubStop {
  return {
    gtfsId: String(raw.gtfsId ?? ""),
    code: raw.code != null ? String(raw.code) : null,
    platformCode: raw.platformCode != null ? String(raw.platformCode) : null,
    vehicleMode: raw.vehicleMode != null ? String(raw.vehicleMode) : null,
  };
}

export const transitRoutes: FastifyPluginAsync = async (server) => {
  server.get<{
    Querystring: {
      lat: string;
      lon: string;
      radius?: string;
      mode?: string;
    };
  }>(
    "/api/v1/transit/stops",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["lat", "lon"],
          properties: {
            lat: { type: "string" },
            lon: { type: "string" },
            radius: { type: "string" },
            mode: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { lat, lon } = parseCoordinates(request.query);

      let radius = 500;
      if (request.query.radius) {
        const parsed = Number(request.query.radius);
        if (Number.isNaN(parsed) || parsed < 100 || parsed > 2000) {
          return badRequest("radius must be a number between 100 and 2000");
        }
        radius = parsed;
      }

      const mode = request.query.mode?.trim() || undefined;

      const { data, cached } = await getNearbyStops(
        lat,
        lon,
        radius,
        request.persona,
        { mode },
      );
      return { data, cached };
    },
  );

  // Adaptive nearby — doubles radius up to 2 km until we surface five stops.
  server.get<{ Querystring: { lat: string; lon: string; mode?: string } }>(
    "/api/v1/transit/stops/nearby-adaptive",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["lat", "lon"],
          properties: {
            lat: { type: "string" },
            lon: { type: "string" },
            mode: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { lat, lon } = parseCoordinates(request.query);
      const mode = request.query.mode?.trim() || undefined;
      const { data, cached, radiusUsed } = await getAdaptiveNearbyStops(
        lat,
        lon,
        request.persona,
        { mode },
      );
      return { data, cached, radiusUsed };
    },
  );

  server.get<{
    Querystring: {
      q?: string;
      mode?: string;
      region?: string;
      byLine?: string;
      operator?: string;
    };
  }>(
    "/api/v1/transit/stops/search",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            mode: { type: "string" },
            region: { type: "string" },
            byLine: { type: "string" },
            operator: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const q = (request.query.q ?? "").trim();
      const byLine = request.query.byLine?.trim() || undefined;
      // byLine is a standalone query path — q is optional when present.
      if (!byLine && q === "") {
        return badRequest("q must not be empty when byLine is not set");
      }

      const { data, cached } = await searchStops(q, request.persona, {
        mode: request.query.mode?.trim() || undefined,
        region: request.query.region?.trim() || undefined,
        byLine,
        operator: request.query.operator?.trim() || undefined,
      });
      return { data, cached };
    },
  );

  server.get<{
    Querystring: { stopId: string; count?: string; isStation?: string };
  }>(
    "/api/v1/transit/departures",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["stopId"],
          properties: {
            stopId: { type: "string" },
            count: { type: "string" },
            isStation: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const stopId = request.query.stopId.trim();
      if (stopId === "") {
        return badRequest("stopId must not be empty");
      }

      let count = 20;
      if (request.query.count) {
        const parsed = Number(request.query.count);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
          return badRequest("count must be a number between 1 and 100");
        }
        count = parsed;
      }

      const isStation = request.query.isStation === "true";
      const { data, cached } = await getStopDepartures(
        stopId,
        count,
        isStation,
        request.persona,
      );
      return { data, cached };
    },
  );

  server.get<{
    Querystring: {
      stopIds: string;
      subStops?: string;
      stationId?: string;
      countPerStop?: string;
      totalCount?: string;
    };
  }>(
    "/api/v1/transit/departures/multi",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["stopIds"],
          properties: {
            stopIds: { type: "string" },
            subStops: { type: "string" },
            stationId: { type: "string" },
            countPerStop: { type: "string" },
            totalCount: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const ids = request.query.stopIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ids.length === 0) {
        return badRequest("stopIds must not be empty");
      }
      if (ids.length > 20) {
        return badRequest("stopIds must contain at most 20 IDs");
      }

      let subStops: TransitSubStop[] = [];
      if (request.query.subStops) {
        const raw = parseJson(
          request.query.subStops,
          isSubStopArray,
          "subStops must be a JSON array of objects",
        );
        subStops = raw.map(coerceSubStop).filter((s) => s.gtfsId !== "");
      }

      let countPerStop = 10;
      if (request.query.countPerStop) {
        const parsed = Number(request.query.countPerStop);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 30) {
          return badRequest("countPerStop must be a number between 1 and 30");
        }
        countPerStop = parsed;
      }

      let totalCount = 40;
      if (request.query.totalCount) {
        const parsed = Number(request.query.totalCount);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
          return badRequest("totalCount must be a number between 1 and 100");
        }
        totalCount = parsed;
      }

      const stationId = request.query.stationId?.trim() || undefined;

      const { data, cached } = await getMultiStopDepartures(
        ids,
        subStops,
        countPerStop,
        totalCount,
        stationId,
        request.persona,
      );
      return { data, cached };
    },
  );

  server.get<{
    Querystring: {
      fromLat: string;
      fromLon: string;
      toLat: string;
      toLon: string;
    };
  }>(
    "/api/v1/transit/plan",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["fromLat", "fromLon", "toLat", "toLon"],
          properties: {
            fromLat: { type: "string" },
            fromLon: { type: "string" },
            toLat: { type: "string" },
            toLon: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const from = parseCoordinates({
        lat: request.query.fromLat,
        lon: request.query.fromLon,
      });
      const to = parseCoordinates({
        lat: request.query.toLat,
        lon: request.query.toLon,
      });

      const { data, cached } = await planRoute(
        from.lat,
        from.lon,
        to.lat,
        to.lon,
        undefined,
        request.persona,
      );
      return { data, cached };
    },
  );

  // Authenticated transit endpoints — pinned + recent stops. Registered as a
  // sub-plugin so the requireAuth hook applies only to these routes without
  // splitting transit.ts into two files.
  await server.register(async (s) => {
    s.addHook("preHandler", requireAuth);

    s.get("/api/v1/transit/pinned-stops", async (request) => {
      const userId = request.session!.user.id;
      const rows = await pinnedStopsRepo.listByUser(userId);
      return { data: rows.map(pinnedStopToResponse) };
    });

    s.post<{
      Body: {
        gtfsId: string;
        name: string;
        vehicleMode?: string | null;
        isStation?: boolean;
      };
    }>(
      "/api/v1/transit/pinned-stops",
      {
        schema: {
          body: {
            type: "object",
            required: ["gtfsId", "name"],
            properties: {
              gtfsId: { type: "string", minLength: 1, maxLength: 255 },
              name: { type: "string", minLength: 1, maxLength: 255 },
              vehicleMode: { type: ["string", "null"], maxLength: 32 },
              isStation: { type: "boolean" },
            },
          },
        },
      },
      async (request, reply) => {
        const userId = request.session!.user.id;
        const row = await pinnedStopsRepo.pin({
          userId,
          gtfsId: request.body.gtfsId,
          name: request.body.name,
          vehicleMode: request.body.vehicleMode ?? null,
          isStation: request.body.isStation ?? false,
        });
        return reply.status(201).send({ data: pinnedStopToResponse(row) });
      },
    );

    s.delete<{ Params: { id: string } }>(
      "/api/v1/transit/pinned-stops/:id",
      {
        schema: {
          params: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "string" } },
          },
        },
      },
      async (request, reply) => {
        const userId = request.session!.user.id;
        const row = await pinnedStopsRepo.unpinById(request.params.id, userId);
        if (!row) {
          throw new NotFoundError("Pinned stop not found");
        }
        return reply.status(204).send();
      },
    );

    s.get<{ Querystring: { limit?: string } }>(
      "/api/v1/transit/recent-stops",
      {
        schema: {
          querystring: {
            type: "object",
            properties: { limit: { type: "string" } },
          },
        },
      },
      async (request) => {
        const userId = request.session!.user.id;
        const limit = parseRecentLimit(request.query.limit);
        const rows = await recentStopsRepo.listByUser(userId, limit);
        return { data: rows.map(recentStopToResponse) };
      },
    );

    s.post<{
      Body: {
        gtfsId: string;
        name: string;
        vehicleMode?: string | null;
        isStation?: boolean;
      };
    }>(
      "/api/v1/transit/recent-stops",
      {
        schema: {
          body: {
            type: "object",
            required: ["gtfsId", "name"],
            properties: {
              gtfsId: { type: "string", minLength: 1, maxLength: 255 },
              name: { type: "string", minLength: 1, maxLength: 255 },
              vehicleMode: { type: ["string", "null"], maxLength: 32 },
              isStation: { type: "boolean" },
            },
          },
        },
      },
      async (request, reply) => {
        const userId = request.session!.user.id;
        const row = await recentStopsRepo.recordVisit({
          userId,
          gtfsId: request.body.gtfsId,
          name: request.body.name,
          vehicleMode: request.body.vehicleMode ?? null,
          isStation: request.body.isStation ?? false,
        });
        return reply.status(201).send({ data: recentStopToResponse(row) });
      },
    );
  });
};

function pinnedStopToResponse(row: pinnedStopsRepo.PinnedStopRow) {
  return {
    id: row.id,
    gtfsId: row.gtfsId,
    name: row.name,
    vehicleMode: row.vehicleMode,
    isStation: row.isStation,
    pinnedAt: row.pinnedAt.toISOString(),
  };
}

function recentStopToResponse(row: recentStopsRepo.RecentStopRow) {
  return {
    id: row.id,
    gtfsId: row.gtfsId,
    name: row.name,
    vehicleMode: row.vehicleMode,
    isStation: row.isStation,
    visitCount: row.visitCount,
    lastVisitedAt: row.lastVisitedAt.toISOString(),
  };
}

const RECENT_STOPS_MAX_LIMIT = 50;

function parseRecentLimit(raw: string | undefined): number {
  if (!raw) return 20;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 20;
  return Math.min(n, RECENT_STOPS_MAX_LIMIT);
}
