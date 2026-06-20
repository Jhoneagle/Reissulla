import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Alert, AlertScope, AlertSeverity } from "@reissulla/shared";

// Mock the data sources the service composes so the test exercises only the
// relevance gate + unread arithmetic, not the DB or upstream alert feeds.
vi.mock("../services/alerts/alerts.service.js", () => ({
  getActive: vi.fn(),
}));
vi.mock("../db/repositories/alert-seen.repo.js", () => ({
  listSeenIds: vi.fn(),
  markSeen: vi.fn(),
}));
vi.mock("../db/repositories/pinned-stops.repo.js", () => ({
  listByUser: vi.fn(),
}));
vi.mock("../db/repositories/pinned-lines.repo.js", () => ({
  listByUser: vi.fn(),
}));

import { getActive } from "../services/alerts/alerts.service.js";
import * as alertSeenRepo from "../db/repositories/alert-seen.repo.js";
import * as pinnedStopsRepo from "../db/repositories/pinned-stops.repo.js";
import * as pinnedLinesRepo from "../db/repositories/pinned-lines.repo.js";
import {
  list,
  markAllRead,
  markRead,
  unreadCount,
} from "../services/notifications/notifications.service.js";

const USER = "user-1";

function alert(
  id: string,
  scope: AlertScope,
  severity: AlertSeverity = "warning",
): Alert {
  return {
    id,
    source: "digitransit",
    severity,
    cause: "OTHER",
    effect: null,
    startTime: 1000,
    endTime: null,
    scope,
    headline: { fi: `otsikko ${id}`, en: `headline ${id}` },
    description: { fi: `kuvaus ${id}`, en: `desc ${id}` },
  };
}

// A pinned stop, a pinned line, plus a representative mix of active alerts.
const STOP_PINNED = alert(
  "stop-pinned-info",
  { kind: "stop", gtfsId: "STOP:1" },
  "info",
);
const STOP_OTHER = alert("stop-other", { kind: "stop", gtfsId: "STOP:2" });
const ROUTE_PINNED = alert("route-pinned", {
  kind: "route",
  gtfsId: "ROUTE:1",
});
const GLOBAL_WARN = alert("global-warn", { kind: "global" }, "warning");
const GLOBAL_INFO = alert("global-info", { kind: "global" }, "info");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActive).mockResolvedValue({
    data: [STOP_PINNED, STOP_OTHER, ROUTE_PINNED, GLOBAL_WARN, GLOBAL_INFO],
    cached: false,
  });
  vi.mocked(pinnedStopsRepo.listByUser).mockResolvedValue([
    { gtfsId: "STOP:1" },
  ] as never);
  vi.mocked(pinnedLinesRepo.listByUser).mockResolvedValue([
    { gtfsId: "ROUTE:1" },
  ] as never);
  vi.mocked(alertSeenRepo.listSeenIds).mockResolvedValue([]);
  vi.mocked(alertSeenRepo.markSeen).mockResolvedValue(undefined);
});

describe("notifications.service.list relevance gate", () => {
  it("keeps pinned-scope alerts (any severity), drops non-pinned and low-impact global", async () => {
    const result = await list(USER);
    const ids = result.map((n) => n.alert.id).sort();
    // Pinned stop (info kept because pinned), pinned route, and the global
    // disruption — but NOT the other stop or the global info notice.
    expect(ids).toEqual(["global-warn", "route-pinned", "stop-pinned-info"]);
  });

  it("flags unread vs seen from the alert_seen set", async () => {
    vi.mocked(alertSeenRepo.listSeenIds).mockResolvedValue(["global-warn"]);
    const result = await list(USER);
    const byId = Object.fromEntries(result.map((n) => [n.alert.id, n.unread]));
    expect(byId["global-warn"]).toBe(false);
    expect(byId["route-pinned"]).toBe(true);
    expect(byId["stop-pinned-info"]).toBe(true);
  });
});

describe("notifications.service.unreadCount", () => {
  it("counts only relevant, not-yet-seen alerts", async () => {
    vi.mocked(alertSeenRepo.listSeenIds).mockResolvedValue(["global-warn"]);
    expect(await unreadCount(USER)).toBe(2);
  });

  it("is zero once everything relevant is seen", async () => {
    vi.mocked(alertSeenRepo.listSeenIds).mockResolvedValue([
      "global-warn",
      "route-pinned",
      "stop-pinned-info",
    ]);
    expect(await unreadCount(USER)).toBe(0);
  });
});

describe("notifications.service mark helpers", () => {
  it("markRead forwards the ids to the repo (idempotency lives in the repo)", async () => {
    await markRead(USER, ["a", "b"]);
    expect(alertSeenRepo.markSeen).toHaveBeenCalledWith(USER, ["a", "b"]);
  });

  it("markAllRead marks exactly the currently-relevant alert ids", async () => {
    await markAllRead(USER);
    const [, ids] = vi.mocked(alertSeenRepo.markSeen).mock.calls[0]!;
    expect([...ids].sort()).toEqual([
      "global-warn",
      "route-pinned",
      "stop-pinned-info",
    ]);
  });
});
