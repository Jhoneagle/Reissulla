/**
 * Format a geocoding result into a two-line display:
 *   primary:   "Kenttätie 10"  or  "Helsinki"
 *   secondary: "Savela, Helsinki"  or  "Uusimaa"
 *
 * Uses structured fields (name, locality, neighbourhood) from Pelias
 * when available, falls back to parsing the label string.
 */
export function formatAddress(result: {
  name?: string;
  displayName: string;
  locality?: string;
  neighbourhood?: string;
}): { primary: string; secondary: string } {
  const primary = result.name || result.displayName.split(",")[0]!.trim();

  // Build secondary from structured fields if available
  if (result.locality || result.neighbourhood) {
    const parts: string[] = [];
    if (result.neighbourhood && result.neighbourhood !== primary) {
      parts.push(result.neighbourhood);
    }
    if (result.locality && result.locality !== primary) {
      parts.push(result.locality);
    }
    return { primary, secondary: parts.join(", ") };
  }

  // Fallback: parse displayName label (e.g. "Helsinki, Uusimaa")
  const parts = result.displayName.split(",").map((s) => s.trim());
  if (parts.length <= 1) {
    return { primary, secondary: "" };
  }

  // Take the part(s) after the primary name, skip the last part (country)
  const rest = parts.slice(1);
  if (rest.length > 1) rest.pop(); // drop country
  return { primary, secondary: rest.slice(0, 2).join(", ") };
}

/**
 * Format a displayName label as a short string for the search input.
 */
export function formatAddressShort(result: {
  name?: string;
  displayName: string;
  locality?: string;
}): string {
  const name = result.name || result.displayName.split(",")[0]!.trim();
  if (result.locality && result.locality !== name) {
    return `${name}, ${result.locality}`;
  }
  return result.displayName;
}
