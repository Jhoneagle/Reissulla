import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { geocodingApi } from "@reissulla/api-client";
import type { GeocodingResult, SavedLocation } from "@reissulla/shared";
import { LeafletMap } from "../components/map/LeafletMap";
import { MapFlyTo } from "../components/map/MapFlyTo";
import { UserLocationMarker } from "../components/map/UserLocationMarker";
import { MapClickHandler } from "../components/map/MapClickHandler";
import { MapResizeHandler } from "../components/map/MapResizeHandler";
import { LocationPopup } from "../components/map/LocationPopup";
import { SavedLocationMarkers } from "../components/map/SavedLocationMarkers";
import { LocationSearch } from "../components/LocationSearch";
import { LocationListView } from "../components/LocationListView";
import { CurrentWeatherCard } from "../components/weather/CurrentWeatherCard";
import { ForecastStrip } from "../components/weather/ForecastStrip";
import { useCurrentWeather, useWeatherForecast } from "../hooks/useWeather";
import { useSavedLocations } from "../hooks/useSavedLocations";
import { useGeolocationStore } from "../stores/geolocation";
import { useMapStore } from "../stores/map";
import "../components/weather/Weather.css";
import "./Map.css";

const HELSINKI = { lat: 60.1699, lon: 24.9384 };

type ViewMode = "map" | "list";

export function MapPage() {
  const [view, setView] = useState<ViewMode>("map");
  const geoPosition = useGeolocationStore((s) => s.position);
  const geoDenied = useGeolocationStore((s) => s.denied);

  const selectedLocation = useMapStore((s) => s.selectedLocation);
  const searchResults = useMapStore((s) => s.searchResults);
  const selectLocation = useMapStore((s) => s.selectLocation);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setSearchResults = useMapStore((s) => s.setSearchResults);

  const defaultCenter = geoPosition ?? HELSINKI;
  const savedLocations = useSavedLocations();

  // Weather is shown for: selected location > GPS position > null
  const weatherTarget = selectedLocation ?? geoPosition;

  const currentWeather = useCurrentWeather(
    weatherTarget?.lat ?? null,
    weatherTarget?.lon ?? null,
  );

  const forecast = useWeatherForecast(
    weatherTarget?.lat ?? null,
    weatherTarget?.lon ?? null,
  );

  const reverseQuery = useQuery({
    queryKey: [
      "reverse-geocoding",
      selectedLocation?.lat,
      selectedLocation?.lon,
    ],
    queryFn: () =>
      geocodingApi.reverse(selectedLocation!.lat, selectedLocation!.lon),
    enabled: !!selectedLocation && !selectedLocation.name,
  });

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      selectLocation({ lat, lon });
    },
    [selectLocation],
  );

  const handleSavedMarkerClick = useCallback(
    (loc: SavedLocation) => {
      selectLocation({
        lat: loc.latitude,
        lon: loc.longitude,
        name: loc.name,
      });
    },
    [selectLocation],
  );

  const handleSearchSelect = useCallback(
    (result: GeocodingResult) => {
      selectLocation({
        lat: result.latitude,
        lon: result.longitude,
        name: result.displayName,
      });
    },
    [selectLocation],
  );

  const popupName =
    selectedLocation?.name ??
    reverseQuery.data?.data.displayName ??
    (reverseQuery.isLoading ? undefined : "Selected location");

  // Short label for the weather panel heading
  const weatherLocationName = selectedLocation
    ? selectedLocation.name?.split(",")[0] ??
      reverseQuery.data?.data.name ??
      "Selected location"
    : geoPosition
      ? "Your location"
      : null;

  return (
    <div className="page-full-width map-page">
      <h2 className="visually-hidden" id="map-heading">
        Map
      </h2>

      {geoDenied && (
        <div className="gps-banner" role="status">
          Allow location access for local results, or search for a place.
        </div>
      )}

      {/* View toggle — positioned at bottom center */}
      <div role="tablist" aria-label="View mode" className="view-toggle">
        <button
          id="tab-map"
          role="tab"
          aria-selected={view === "map"}
          aria-controls="panel-map"
          onClick={() => setView("map")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Map
        </button>
        <button
          id="tab-list"
          role="tab"
          aria-selected={view === "list"}
          aria-controls="panel-list"
          onClick={() => setView("list")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          List
        </button>
      </div>

      <div
        id="panel-map"
        role="tabpanel"
        aria-labelledby="tab-map"
        className="map-panel"
        hidden={view !== "map"}
      >
        <div className="map-search-wrapper">
          <LocationSearch
            id="map-search"
            onSelect={handleSearchSelect}
            onResults={view === "map" ? setSearchResults : undefined}
          />
        </div>

        {/* Weather panel — top right overlay on map */}
        {weatherTarget && (
          <div className="weather-panel" aria-label="Weather for active location">
            {weatherLocationName && (
              <p className="weather-panel__heading">{weatherLocationName}</p>
            )}
            <CurrentWeatherCard
              data={currentWeather.data?.data}
              isLoading={currentWeather.isLoading}
              isError={currentWeather.isError}
              isStale={currentWeather.isStale}
              dataUpdatedAt={currentWeather.dataUpdatedAt}
              onRetry={currentWeather.refetch}
            />
            <ForecastStrip
              days={forecast.data?.data.daily}
              isLoading={forecast.isLoading}
              isError={forecast.isError}
            />
          </div>
        )}

        <LeafletMap center={[defaultCenter.lat, defaultCenter.lon]} zoom={13}>
          <MapResizeHandler visible={view === "map"} />
          {selectedLocation && (
            <MapFlyTo lat={selectedLocation.lat} lon={selectedLocation.lon} />
          )}
          {geoPosition && (
            <UserLocationMarker
              position={[geoPosition.lat, geoPosition.lon]}
            />
          )}
          <MapClickHandler onClick={handleMapClick} />
          {savedLocations.data?.data && (
            <SavedLocationMarkers
              locations={savedLocations.data.data}
              onSelect={handleSavedMarkerClick}
            />
          )}
          {selectedLocation && (
            <LocationPopup
              position={[selectedLocation.lat, selectedLocation.lon]}
              name={popupName}
              loading={reverseQuery.isLoading}
              onClose={clearSelection}
            />
          )}
        </LeafletMap>
      </div>

      <div
        id="panel-list"
        role="tabpanel"
        aria-labelledby="tab-list"
        className="list-panel"
        hidden={view !== "list"}
      >
        <div className="list-panel-search">
          <LocationSearch
            id="list-search"
            onSelect={handleSearchSelect}
            onResults={view === "list" ? setSearchResults : undefined}
          />
        </div>
        <LocationListView
          results={searchResults}
          userPosition={geoPosition}
          selectedLocation={selectedLocation}
        />
      </div>
    </div>
  );
}
