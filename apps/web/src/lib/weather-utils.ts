/**
 * Weather display utilities — SVG icon paths, formatting, and wind helpers.
 *
 * Each icon is a single SVG path drawn at 24×24 viewBox so components can
 * render them inline without extra HTTP requests.
 */

/** Minimal SVG path data keyed by WMO weather code range. */
export function getWeatherIcon(code: number, isDay: boolean): string {
  // Clear
  if (code === 0) {
    return isDay
      ? "M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"
      : "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z";
  }
  // Mainly clear / partly cloudy
  if (code <= 2) {
    return isDay
      ? "M10 2v1m-5.07.93l.71.71M2 10h1m15 0a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6z"
      : "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM15 2a5 5 0 0 1 .9 3";
  }
  // Overcast
  if (code === 3) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6z";
  }
  // Fog
  if (code <= 48) {
    return "M3 10h18M3 14h18M5 6h14a3 3 0 0 1 0 0H5a3 3 0 0 1 0 0zM6 18h12";
  }
  // Drizzle
  if (code <= 57) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM8 19v1m4-2v1m4-2v1";
  }
  // Rain
  if (code <= 65) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM7 19l-1 2m5-3l-1 2m5-3l-1 2";
  }
  // Freezing rain
  if (code <= 67) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM8 19l-1 2m5-3l-1 2m5-3l-1 2M12 3v2";
  }
  // Snow
  if (code <= 77) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM8 18l.01.01M12 20l.01.01M16 18l.01.01M10 22l.01.01M14 22l.01.01";
  }
  // Rain showers
  if (code <= 82) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM7 19l-1 2m5-3l-1 2m5-3l-1 2m-8-1l-1 2m5-3l-1 2";
  }
  // Snow showers
  if (code <= 86) {
    return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM8 18l.01.01M12 18l.01.01M16 18l.01.01M10 21l.01.01M14 21l.01.01";
  }
  // Thunderstorm
  return "M18 10a5 5 0 0 0-9.8-1.2A3.5 3.5 0 0 0 5.5 16H18a3 3 0 0 0 0-6zM13 16l-2 4h4l-2 4";
}

/** Cardinal direction from degrees. */
export function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

/** Human-readable relative time, e.g. "2 min ago". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Check if an ISO date string is today. */
export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Short day name from ISO date string. */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { weekday: "short" });
}