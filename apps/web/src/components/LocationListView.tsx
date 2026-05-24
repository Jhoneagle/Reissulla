import { useState, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { GeocodingResult, SavedLocation } from "@reissulla/shared";
import { ListRowWeather } from "./weather/ListRowWeather";
import { ListRowForecast } from "./weather/ListRowForecast";
import { SaveToggleButton } from "./SaveToggleButton";
import { formatAddress } from "../lib/format-address";
import { coordsMatch } from "../lib/geo";
import { useAuthStore } from "../stores/auth";

interface LocationListViewProps {
  results: GeocodingResult[];
  userPosition: { lat: number; lon: number } | null;
  selectedLocation: { lat: number; lon: number; name?: string } | null;
  savedLocations: SavedLocation[];
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
  savedId: string | null;
  source: "saved" | "search" | "selected";
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
  savedLocations,
}: LocationListViewProps) {
  const intl = useIntl();
  const isAuthenticated = !!useAuthStore((s) => s.user);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const { savedRows, otherRows } = useMemo(() => {
    const distFor = (lat: number, lon: number) =>
      userPosition
        ? haversineKm(userPosition.lat, userPosition.lon, lat, lon)
        : null;

    // Build saved location rows — these always go to the saved section.
    // Enrich with search result data if a match exists.
    const savedRowList: ListRow[] = savedLocations.map((loc) => {
      const matchingResult = results.find((r) =>
        coordsMatch(r.latitude, r.longitude, loc.latitude, loc.longitude),
      );
      return {
        name: matchingResult?.name,
        displayName: matchingResult?.displayName ?? loc.name,
        locality: matchingResult?.locality,
        neighbourhood: matchingResult?.neighbourhood,
        lat: loc.latitude,
        lon: loc.longitude,
        distance: distFor(loc.latitude, loc.longitude),
        savedId: loc.id,
        source: "saved" as const,
      };
    });

    // Build search result rows — exclude any that match a saved location
    // (those are already shown in the saved section above).
    const searchRows: ListRow[] = results
      .filter(
        (r) =>
          !savedLocations.some((loc) =>
            coordsMatch(loc.latitude, loc.longitude, r.latitude, r.longitude),
          ),
      )
      .map((r) => ({
        name: r.name,
        displayName: r.displayName,
        locality: r.locality,
        neighbourhood: r.neighbourhood,
        lat: r.latitude,
        lon: r.longitude,
        distance: distFor(r.latitude, r.longitude),
        savedId: null,
        source: "search" as const,
      }));

    // Build selected location row (if not already in search or saved)
    const selectionRows: ListRow[] = [];
    if (
      selectedLocation &&
      !results.some((r) =>
        coordsMatch(
          r.latitude,
          r.longitude,
          selectedLocation.lat,
          selectedLocation.lon,
        ),
      ) &&
      !savedLocations.some((loc) =>
        coordsMatch(
          loc.latitude,
          loc.longitude,
          selectedLocation.lat,
          selectedLocation.lon,
        ),
      )
    ) {
      selectionRows.push({
        displayName:
          selectedLocation.name ??
          intl.formatMessage({ id: "locationList.selectedLocation" }),
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
        distance: distFor(selectedLocation.lat, selectedLocation.lon),
        savedId: null,
        source: "selected",
      });
    }

    const sortRows = (rows: ListRow[]) => {
      const sorted = [...rows];
      sorted.sort((a, b) => {
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
      return sorted;
    };

    return {
      savedRows: sortRows(savedRowList),
      otherRows: sortRows([...selectionRows, ...searchRows]),
    };
  }, [
    intl,
    results,
    selectedLocation,
    userPosition,
    savedLocations,
    sortField,
    sortAsc,
  ]);

  const totalRows = savedRows.length + otherRows.length;

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

  const showDivider = savedRows.length > 0 && otherRows.length > 0;
  const colCount = isAuthenticated ? 5 : 4;

  // Arrow glyphs for the sort indicators. Pulled out of JSX so the
  // formatjs/no-literal-string-in-jsx rule doesn't trip over them —
  // they're purely typographic, locale-neutral.
  const sortGlyph = (active: boolean) => (active ? (sortAsc ? "↑" : "↓") : "");

  if (totalRows === 0) {
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
          <p>
            <FormattedMessage id="locationList.empty.searchHint" />
          </p>
        </div>
      </div>
    );
  }

  const renderRow = (row: ListRow) => {
    const addr = formatAddress(row);
    const isSavedOnly = row.source === "saved";
    return (
      <tr
        key={`${row.source}-${row.lat}-${row.lon}`}
        className={isSavedOnly ? "list-row--saved" : undefined}
      >
        {isAuthenticated && (
          <td className="cell-actions">
            <SaveToggleButton
              savedId={row.savedId}
              lat={row.lat}
              lon={row.lon}
              name={row.displayName}
            />
          </td>
        )}
        <td className="cell-name">
          <span className="cell-name__primary">{addr.primary}</span>
          {addr.secondary && (
            <span className="cell-name__secondary">{addr.secondary}</span>
          )}
        </td>
        <td className="cell-weather">
          <ListRowWeather lat={row.lat} lon={row.lon} />
        </td>
        <td className="cell-forecast">
          <ListRowForecast lat={row.lat} lon={row.lon} />
        </td>
        <td className="cell-distance">{formatDistance(row.distance)}</td>
      </tr>
    );
  };

  return (
    <div className="location-list">
      <table>
        <caption className="visually-hidden">
          {savedRows.length > 0 ? (
            <FormattedMessage
              id="locationList.caption.withSaved"
              values={{
                saved: savedRows.length,
                results: otherRows.length,
              }}
            />
          ) : (
            <FormattedMessage
              id="locationList.caption.resultsOnly"
              values={{ count: otherRows.length }}
            />
          )}
        </caption>
        <thead>
          <tr>
            {isAuthenticated && (
              <th scope="col" className="cell-actions">
                <span className="visually-hidden">
                  <FormattedMessage id="locationList.column.save" />
                </span>
              </th>
            )}
            <th
              scope="col"
              aria-sort={ariaSortValue("name", sortField, sortAsc)}
            >
              <button type="button" onClick={() => toggleSort("name")}>
                <FormattedMessage id="locationList.column.name" />
                <span aria-hidden="true" style={{ marginLeft: "0.25em" }}>
                  {sortGlyph(sortField === "name")}
                </span>
              </button>
            </th>
            <th scope="col">
              <FormattedMessage id="locationList.column.weather" />
            </th>
            <th scope="col">
              <FormattedMessage id="locationList.column.forecast" />
            </th>
            <th
              scope="col"
              aria-sort={ariaSortValue("distance", sortField, sortAsc)}
            >
              <button type="button" onClick={() => toggleSort("distance")}>
                <FormattedMessage id="locationList.column.distance" />
                <span aria-hidden="true" style={{ marginLeft: "0.25em" }}>
                  {sortGlyph(sortField === "distance")}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {savedRows.map(renderRow)}
          {showDivider && (
            <tr className="list-group-divider" aria-hidden="true">
              <td colSpan={colCount} />
            </tr>
          )}
          {otherRows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}
