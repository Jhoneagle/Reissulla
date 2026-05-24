/**
 * Build a share URL for a location using only the URL fragment (`#…`).
 * Fragment-only is the deliberate Phase 1 design: the server never sees
 * the data, so no token table or expiry handling is needed, and the URL
 * stays human-readable. Coordinates are public-by-nature.
 *
 * Format: `<origin>/l#lat=…&lon=…&z=…&n=…`
 *
 * `z` (zoom) and `n` (display name) are optional; recipients without them
 * just see the coordinates on the map.
 */
export interface LocationShareInput {
  lat: number;
  lon: number;
  zoom?: number;
  name?: string;
}

export function buildLocationShareUrl(input: LocationShareInput): string {
  const origin =
    typeof window === "undefined"
      ? "https://reissulla.fi"
      : window.location.origin;
  const params = new URLSearchParams();
  params.set("lat", input.lat.toFixed(5));
  params.set("lon", input.lon.toFixed(5));
  if (input.zoom !== undefined) params.set("z", String(input.zoom));
  if (input.name) params.set("n", input.name);
  return `${origin}/l#${params.toString()}`;
}

/**
 * Best-effort native share with clipboard fallback. Returns whether the
 * share completed (true) or the user dismissed it (false). Throws on
 * actual errors (e.g. clipboard rejected).
 */
export async function shareLocation(
  input: LocationShareInput,
  title: string,
): Promise<boolean> {
  const url = buildLocationShareUrl(input);
  // Web Share API is the right primitive when available (mobile + Safari).
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
      return true;
    } catch (err) {
      // AbortError = user dismissed; not actually an error.
      if (
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("cancelled"))
      ) {
        return false;
      }
      // fall through to clipboard
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  }
  return false;
}
