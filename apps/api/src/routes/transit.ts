import type { FastifyPluginAsync } from "fastify";
import type { TransitSubStop } from "@reissulla/shared";
import {
  getNearbyStops,
  getAdaptiveNearbyStops,
  searchStops,
  getStopDepartures,
  getMultiStopDepartures,
  getFirstLastOfDay,
  planRoute,
  getTripDetail,
  searchLines,
  getLine,
  getLineDepartures,
  getFrequency,
  type DeparturesOptions,
  type ArrivalDepartureMode,
} from "../services/transit/index.js";
import { badRequest, parseCoordinates } from "../utils/validation.js";
import { parseJson } from "../utils/json.js";
import { requireAuth } from "../auth/middleware.js";
import { NotFoundError } from "../utils/error-envelope.js";
import * as pinnedStopsRepo from "../db/repositories/pinned-stops.repo.js";
import * as pinnedLinesRepo from "../db/repositories/pinned-lines.repo.js";
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
    Querystring: {
      stopId: string;
      count?: string;
      isStation?: string;
      at?: string;
      mode?: string;
      lineFilter?: string;
      directionFilter?: string;
      lowFloorOnly?: string;
    };
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
            at: { type: "string" },
            mode: { type: "string" },
            lineFilter: { type: "string" },
            directionFilter: { type: "string" },
            lowFloorOnly: { type: "string" },
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
      const options = parseDeparturesOptions(request.query);
      if (typeof options === "string") return badRequest(options);

      const { data, cached } = await getStopDepartures(
        stopId,
        count,
        isStation,
        request.persona,
        options,
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
      at?: string;
      mode?: string;
      lineFilter?: string;
      directionFilter?: string;
      lowFloorOnly?: string;
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
            at: { type: "string" },
            mode: { type: "string" },
            lineFilter: { type: "string" },
            directionFilter: { type: "string" },
            lowFloorOnly: { type: "string" },
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
      // 50 covers the largest Finnish station clusters (Helsinki long-
      // distance terminal, Kamppi bus terminal). MAX_PARALLEL_STOP_QUERIES
      // in the service already throttles upstream load.
      if (ids.length > 50) {
        return badRequest("stopIds must contain at most 50 IDs");
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
      const options = parseDeparturesOptions(request.query);
      if (typeof options === "string") return badRequest(options);

      const { data, cached } = await getMultiStopDepartures(
        ids,
        subStops,
        countPerStop,
        totalCount,
        stationId,
        request.persona,
        options,
      );
      return { data, cached };
    },
  );

  // First / last departure of the day at a stop (DEP-9).
  server.get<{ Querystring: { stopId: string; date?: string } }>(
    "/api/v1/transit/departures/first-last",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["stopId"],
          properties: {
            stopId: { type: "string" },
            // YYYYMMDD; defaults to today in the feed's timezone.
            date: { type: "string", pattern: "^\\d{8}$" },
          },
        },
      },
    },
    async (request) => {
      const stopId = request.query.stopId.trim();
      if (stopId === "") return badRequest("stopId must not be empty");
      const date = request.query.date?.trim() || todayServiceDateYYYYMMDD();
      const { data, cached } = await getFirstLastOfDay(
        stopId,
        date,
        request.persona,
      );
      return { data, cached };
    },
  );

  // Line catalogue search by short or long name (LINE-1 discovery gate).
  // `region` keys off `preferences.transitRegion` and picks the upstream
  // graph — `"all"` (or unset) fans the query across the Finland-wide adapter
  // so cross-region disambiguation ("25" → Tampere 25 + HSL 25) surfaces.
  server.get<{ Querystring: { q?: string; region?: string } }>(
    "/api/v1/transit/lines/search",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            region: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const q = (request.query.q ?? "").trim();
      if (q === "") return badRequest("q must not be empty");
      const region = request.query.region?.trim() || undefined;
      const { data, cached } = await searchLines(q, region, request.persona);
      return { data, cached };
    },
  );

  // Single-line metadata + both directional patterns + per-pattern stops.
  // The LineView page consumes this on first paint.
  server.get<{ Params: { gtfsId: string } }>(
    "/api/v1/transit/lines/:gtfsId",
    {
      schema: {
        params: {
          type: "object",
          required: ["gtfsId"],
          properties: { gtfsId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request) => {
      const gtfsId = decodeURIComponent(request.params.gtfsId).trim();
      if (gtfsId === "") return badRequest("gtfsId must not be empty");
      const { data, cached } = await getLine(gtfsId, request.persona);
      return { data, cached };
    },
  );

  // Per-stop "next on this line" enrichment for the LineView stop spine.
  // direction=0|1 picks which pattern's stops to fan out across.
  server.get<{
    Params: { gtfsId: string };
    Querystring: { direction?: string };
  }>(
    "/api/v1/transit/lines/:gtfsId/departures",
    {
      schema: {
        params: {
          type: "object",
          required: ["gtfsId"],
          properties: { gtfsId: { type: "string", minLength: 1 } },
        },
        querystring: {
          type: "object",
          properties: { direction: { type: "string", enum: ["0", "1"] } },
        },
      },
    },
    async (request) => {
      const gtfsId = decodeURIComponent(request.params.gtfsId).trim();
      if (gtfsId === "") return badRequest("gtfsId must not be empty");
      const direction =
        request.query.direction === "0"
          ? 0
          : request.query.direction === "1"
            ? 1
            : undefined;
      const { data, cached } = await getLineDepartures(
        gtfsId,
        direction,
        request.persona,
      );
      return { data, cached };
    },
  );

  // Day-of-day-type frequency rhythm for the LineView strip.
  server.get<{
    Params: { gtfsId: string };
    Querystring: { dayType?: string; direction?: string };
  }>(
    "/api/v1/transit/lines/:gtfsId/frequency",
    {
      schema: {
        params: {
          type: "object",
          required: ["gtfsId"],
          properties: { gtfsId: { type: "string", minLength: 1 } },
        },
        querystring: {
          type: "object",
          properties: {
            dayType: {
              type: "string",
              enum: ["weekday", "saturday", "sunday"],
            },
            direction: { type: "string", enum: ["0", "1"] },
          },
        },
      },
    },
    async (request) => {
      const gtfsId = decodeURIComponent(request.params.gtfsId).trim();
      if (gtfsId === "") return badRequest("gtfsId must not be empty");
      const dayType =
        (request.query.dayType as "weekday" | "saturday" | "sunday") ??
        "weekday";
      const direction =
        request.query.direction === "0"
          ? 0
          : request.query.direction === "1"
            ? 1
            : undefined;
      const { data, cached } = await getFrequency(
        gtfsId,
        dayType,
        direction,
        request.persona,
      );
      return { data, cached };
    },
  );

  server.get<{ Params: { tripId: string } }>(
    "/api/v1/transit/trip/:tripId",
    {
      schema: {
        params: {
          type: "object",
          required: ["tripId"],
          properties: { tripId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request) => {
      const tripId = request.params.tripId.trim();
      if (tripId === "") return badRequest("tripId must not be empty");
      const { data, cached } = await getTripDetail(tripId, request.persona);
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

    // ── Pinned lines ──
    s.get("/api/v1/transit/pinned-lines", async (request) => {
      const userId = request.session!.user.id;
      const rows = await pinnedLinesRepo.listByUser(userId);
      return { data: rows.map(pinnedLineToResponse) };
    });

    s.post<{
      Body: {
        gtfsId: string;
        name: string;
        vehicleMode: string;
      };
    }>(
      "/api/v1/transit/pinned-lines",
      {
        schema: {
          body: {
            type: "object",
            required: ["gtfsId", "name", "vehicleMode"],
            properties: {
              gtfsId: { type: "string", minLength: 1, maxLength: 255 },
              name: { type: "string", minLength: 1, maxLength: 255 },
              // NOT NULL on the column; a missing mode is a buggy caller.
              vehicleMode: { type: "string", minLength: 1, maxLength: 32 },
            },
          },
        },
      },
      async (request, reply) => {
        const userId = request.session!.user.id;
        const row = await pinnedLinesRepo.pin({
          userId,
          gtfsId: request.body.gtfsId,
          name: request.body.name,
          vehicleMode: request.body.vehicleMode,
        });
        return reply.status(201).send({ data: pinnedLineToResponse(row) });
      },
    );

    s.delete<{ Params: { id: string } }>(
      "/api/v1/transit/pinned-lines/:id",
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
        const row = await pinnedLinesRepo.unpinById(request.params.id, userId);
        if (!row) {
          throw new NotFoundError("Pinned line not found");
        }
        return reply.status(204).send();
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

function pinnedLineToResponse(row: pinnedLinesRepo.PinnedLineRow) {
  return {
    id: row.id,
    gtfsId: row.gtfsId,
    name: row.name,
    vehicleMode: row.vehicleMode,
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

function todayServiceDateYYYYMMDD(): string {
  // Default service date is today in Europe/Helsinki — the feed timezone.
  // `en-CA` formats with `YYYY-MM-DD` separators which we strip to GTFS's
  // YYYYMMDD shape.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts.replace(/-/g, "");
}

const ALLOWED_ARRIVAL_DEPARTURE = new Set<ArrivalDepartureMode>([
  "departures",
  "arrivals",
  "both",
]);

/**
 * Parse the at / mode / filter query params for departures. Returns a
 * `DeparturesOptions` on success, or an error string on the first
 * validation failure (route caller wraps it in a 400). Empty/unset params
 * leave the option undefined.
 */
function parseDeparturesOptions(query: {
  at?: string;
  mode?: string;
  lineFilter?: string;
  directionFilter?: string;
  lowFloorOnly?: string;
}): DeparturesOptions | string {
  const options: DeparturesOptions = {};
  if (query.at) {
    const at = Number(query.at);
    if (!Number.isFinite(at) || at <= 0) {
      return "at must be a positive unix timestamp";
    }
    options.at = Math.floor(at);
  }
  if (query.mode) {
    const m = query.mode as ArrivalDepartureMode;
    if (!ALLOWED_ARRIVAL_DEPARTURE.has(m)) {
      return "mode must be one of departures | arrivals | both";
    }
    options.mode = m;
  }
  if (query.lineFilter) {
    const list = query.lineFilter
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) options.lineFilter = list;
  }
  if (query.directionFilter) {
    const dir = query.directionFilter.trim();
    if (dir.length > 0) options.directionFilter = dir;
  }
  if (query.lowFloorOnly === "true") options.lowFloorOnly = true;
  return options;
}
