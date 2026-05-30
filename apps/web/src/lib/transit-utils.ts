export function departureToEpoch(
  serviceDay: number,
  secondsFromMidnight: number,
): number {
  return serviceDay * 1000 + secondsFromMidnight * 1000;
}

export function formatDepartureTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(epochMs: number): string {
  const diffMs = epochMs - Date.now();
  const mins = Math.round(diffMs / 60_000);
  if (mins === 0) return "now";
  if (mins < 0) return `${Math.abs(mins)} min ago`;
  return `in ${mins} min`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatWalkDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function vehicleModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    BUS: "Bus",
    TRAM: "Tram",
    RAIL: "Train",
    SUBWAY: "Metro",
    FERRY: "Ferry",
    WALK: "Walk",
  };
  return labels[mode] ?? mode;
}

export function vehicleModeColor(mode: string): string {
  const colors: Record<string, string> = {
    BUS: "#2563eb",
    TRAM: "#059669",
    RAIL: "#7c3aed",
    SUBWAY: "#ea580c",
    FERRY: "#0891b2",
    WALK: "#64748b",
  };
  return colors[mode] ?? "#64748b";
}

/**
 * Token name for the design-system mode-tag class (light tint + 4px brand
 * edge). Returns the lowercased mode segment used by `mode-{bus|tram|…}`;
 * an unknown mode falls back to the bus tone so we never render an
 * un-themed tag with no edge bar.
 */
export function vehicleModeToken(mode: string | null | undefined): string {
  const known = new Set(["bus", "tram", "rail", "subway", "ferry"]);
  const lc = (mode ?? "").toLowerCase();
  return known.has(lc) ? lc : "bus";
}

export function formatUnixTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Day-type bucket matching today's wall clock in Europe/Helsinki. Used as
 * the default for the LineView frequency-strip day-type tabs so a user
 * landing on a line on a Saturday sees Saturday's headways pre-selected.
 * Picks the GTFS service-day-aware date so pre-04:00 hours still resolve
 * to the previous day's bucket (the convention used by frequency bands).
 */
export function dayTypeForToday(
  nowUnix: number = Math.floor(Date.now() / 1000),
): "weekday" | "saturday" | "sunday" {
  // Wall-clock day-of-week in Helsinki, accounting for the 04:00 service
  // rollover: anything before 04:00 reports as the previous day so a 02:00
  // tram ride still classifies under the Saturday timetable.
  const ROLLOVER_HOUR = 4;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  let weekday = "";
  let hour = 0;
  for (const part of fmt.formatToParts(new Date(nowUnix * 1000))) {
    if (part.type === "weekday") weekday = part.value;
    else if (part.type === "hour") hour = Number(part.value);
  }
  if (hour === 24) hour = 0;
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let idx = order.indexOf(weekday);
  if (idx === -1) return "weekday";
  if (hour < ROLLOVER_HOUR) idx = (idx + 6) % 7;
  if (idx === 6) return "saturday";
  if (idx === 0) return "sunday";
  return "weekday";
}

/**
 * Format the "next departure" clock-time used by the sparse-frequency
 * kicker. Same-day departures show just the clock; departures on the
 * next calendar day get a "huomenna"/"tomorrow" qualifier; anything
 * further out gets a short date prefix.
 *
 * `nowUnix` defaults to the current wall clock — passed in primarily
 * for deterministic tests.
 */
export function formatNextDeparture(
  unixSeconds: number,
  locale: "fi" | "en",
  nowUnix: number = Math.floor(Date.now() / 1000),
): string {
  const tz = "Europe/Helsinki";
  const dateKey = (sec: number) =>
    new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: tz });
  const clock = (sec: number) =>
    new Date(sec * 1000).toLocaleTimeString("fi-FI", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    });

  const today = dateKey(nowUnix);
  const target = dateKey(unixSeconds);

  if (today === target) return clock(unixSeconds);

  const tomorrow = dateKey(nowUnix + 24 * 60 * 60);
  if (tomorrow === target) {
    return locale === "fi"
      ? `huomenna ${clock(unixSeconds)}`
      : `tomorrow ${clock(unixSeconds)}`;
  }

  const datePart = new Date(unixSeconds * 1000).toLocaleDateString("fi-FI", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
  });
  return `${datePart} ${clock(unixSeconds)}`;
}
