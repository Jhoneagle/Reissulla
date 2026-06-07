import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { registry } from "../services/realtime/index.js";
import type { ChannelKey } from "../services/realtime/index.js";
import { getFeatureFlags } from "../services/featureFlag.service.js";

const DEFAULT_KEEPALIVE_MS = 15_000;

/**
 * Test seam — when set (in milliseconds), overrides the heartbeat cadence
 * for every subsequent SSE attach. Tests set this so the keep-alive can be
 * observed within an it() block instead of waiting 15 real seconds.
 */
let testKeepaliveMs: number | null = null;
export function __setKeepaliveMsForTest(ms: number | null): void {
  testKeepaliveMs = ms;
}

/**
 * Three SSE endpoints — per-stop departures, per-line vehicles, and the
 * composed alerts stream. Chunk 1 ships the plumbing only: the channel
 * factories are stubs, so connections stay open with keep-alive comments
 * but emit no `data:` lines yet. Chunks 2/3/4 swap in real publishers
 * without touching this file.
 *
 * Feature-flag-off (`feature.realtimeSse=false`) returns 503 cleanly so
 * the FE fallback (30 s polling) can take over.
 */
export const realtimeRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { gtfsId: string } }>(
    "/api/v1/transit/stops/:gtfsId/live",
    { schema: { hide: true } },
    (req, reply) => attachStream(req, reply, `stop:${req.params.gtfsId}`),
  );

  server.get<{ Params: { gtfsId: string } }>(
    "/api/v1/transit/lines/:gtfsId/live",
    { schema: { hide: true } },
    (req, reply) => attachStream(req, reply, `line:${req.params.gtfsId}`),
  );

  server.get(
    "/api/v1/alerts/live",
    { schema: { hide: true } },
    (req, reply) => {
      const userId = req.session?.user.id;
      // Scope key separates per-user feeds. Anonymous gets "anon" — the
      // alerts.service in Chunk 4 will filter by pinned stops/lines from
      // the session (anonymous = unfiltered global set).
      return attachStream(req, reply, `alerts:${userId ?? "anon"}`);
    },
  );
};

function attachStream(
  req: FastifyRequest,
  reply: FastifyReply,
  key: ChannelKey,
): void {
  if (!getFeatureFlags().feature.realtimeSse) {
    void reply.status(503).send({
      error: {
        code: "REALTIME_DISABLED",
        message: "Realtime stream is currently disabled — please retry later",
        source: "realtime",
      },
    });
    return;
  }

  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  // Nginx default is 60 s for proxy_read_timeout on the upstream block; the
  // 15 s heartbeat keeps comfortably inside that window even with one
  // missed tick.
  reply.raw.flushHeaders();

  const channel = registry.get<unknown>(key);
  const unsub = channel.subscribe((event) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    reply.raw.write(":\n\n");
  }, testKeepaliveMs ?? DEFAULT_KEEPALIVE_MS);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    unsub();
  };

  req.raw.on("close", cleanup);
  req.raw.on("aborted", cleanup);
  reply.raw.on("close", cleanup);
}
