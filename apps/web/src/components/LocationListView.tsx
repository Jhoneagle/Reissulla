import { useState, useMemo } from "react";
import type { GeocodingResult } from "@reissulla/shared";
import { ListRowWeather } from "./weather/ListRowWeather";
import { ListRowForecast } from "./weather/ListRowForecast";
import { formatAddress } from "../lib/format-address";

interface LocationListViewProps {
  results: GeocodingResult[];
  userPosition: { lat: number; lon: number } | null;
  selectedLocation: { lat: number; lon: number; name?: string } | null;
}

type SortField = "name" | "distance";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ListRow {
  name?: string;
  displayName: string;
  locality?: string;
  neighbourhood?: string;
  lat: number;
  lon: number;
  distance: number | null;
}

function ariaSortValue(
  field: SortField,
  currentField: SortField,
  asc: boolean,
): "ascending" | "descending" | "none" {
  if (field !== currentField) return "none";
  return asc ? "ascending" : "descending";
}

export function LocationListView({
  results,
  userPosition,
  selectedLocation,
}: LocationListViewProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo<ListRow[]>(() => {
    const items: ListRow[] = results.map((r) => ({
      name: r.name,
      displayName: r.displayName,
      locality: r.locality,
      neighbourhood: r.neighbourhood,
      lat: r.latitude,
      lon: r.longitude,
      distance: userPosition
        ? haversineKm(userPosition.lat, userPosition.lon, r.latitude, r.longitude)
        : null,
    }));

    if (
      selectedLocation &&
      !results.some(
        (r) =>
          r.latitude === selectedLocation.lat &&
          r.longitude === selectedLocation.lon,
      )
    ) {
      items.unshift({
        displayName: selectedLocation.name ?? "Selected location",
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
        distance: userPosition
          ? haversineKm(
              userPosition.lat,
              userPosition.lon,
              selectedLocation.lat,
              selectedLocation.lon,
            )
          : null,
      });
    }

    items.sort((a, b) => {
      let cmp: number;
      if (sortField === "distance") {
        if (a.distance === null && b.distance === null) cmp = 0;
        else if (a.distance === null) cmp = 1;
        else if (b.distance === null) cmp = -1;
        else cmp = a.distance - b.distance;
      } else {
        cmp = a.displayName.localeCompare(b.displayName);
      }
      return sortAsc ? cmp : -cmp;
    });

    return items;
  }, [results, selectedLocation, userPosition, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const formatDistance = (d: number | null) => {
    if (d === null) return "\u2014";
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  if (rows.length === 0) {
    return (
      <div className="location-list">
        <div className="empty-state">
          <svg
            className="empty-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p>Search for a location or click on the map to see results here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="location-list">
      <table>
        <caption className="visually-hidden">
          Locations &mdash; {rows.length}{" "}
          {rows.length === 1 ? "result" : "results"}
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              aria-sort={ariaSortValue("name", sortField, sortAsc)}
            >
              <button type="button" onClick={() => toggleSort("name")}>
                Name{" "}
                {sortField === "name" ? (sortAsc ? "\u2191" : "\u2193") : ""}
              </button>
            </th>
            <th scope="col">Weather</th>
            <th scope="col">Forecast</th>
            <th
              scope="col"
              aria-sort={ariaSortValue("distance", sortField, sortAsc)}
            >
              <button type="button" onClick={() => toggleSort("distance")}>
                Distance{" "}
                {sortField === "distance"
                  ? sortAsc
                    ? "\u2191"
                    : "\u2193"
                  : ""}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const addr = formatAddress(row);
            return (
              <tr key={`${row.lat}-${row.lon}`}>
                <td className="cell-name">
                  <span className="cell-name__primary">{addr.primary}</span>
                  {addr.secondary && (
                    <span className="cell-name__secondary">
                      {addr.secondary}
                    </span>
                  )}
                </td>
                <td className="cell-weather">
                  <ListRowWeather lat={row.lat} lon={row.lon} />
                </td>
                <td className="cell-forecast">
                  <ListRowForecast lat={row.lat} lon={row.lon} />
                </td>
                <td className="cell-distance">
                  {formatDistance(row.distance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
