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
