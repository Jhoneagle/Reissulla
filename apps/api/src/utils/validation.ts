import { BadRequestError } from "./error-envelope.js";

export function badRequest(message: string): never {
  throw new BadRequestError(message);
}

export function parseCoordinates(query: { lat: string; lon: string }): {
  lat: number;
  lon: number;
} {
  const lat = Number(query.lat);
  const lon = Number(query.lon);

  if (
    query.lat === "" ||
    query.lon === "" ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    return badRequest("lat and lon must be valid numbers");
  }
  if (lat < -90 || lat > 90) {
    return badRequest("lat must be between -90 and 90");
  }
  if (lon < -180 || lon > 180) {
    return badRequest("lon must be between -180 and 180");
  }

  return { lat, lon };
}
