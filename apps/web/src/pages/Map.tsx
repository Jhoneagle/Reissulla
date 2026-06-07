import { useCallback, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import { geocodingApi } from "@reissulla/api-client";
import type { GeocodingResult, SavedLocation } from "@reissulla/shared";
import { FollowMeToggle } from "../components/map/FollowMeToggle";
import { LayerControl } from "../components/map/LayerControl";
import { LeafletMap } from "../components/map/LeafletMap";
import { MapFlyTo } from "../components/map/MapFlyTo";
import { MapFollowMe } from "../components/map/MapFollowMe";
import { MapShareUrl } from "../components/map/MapShareUrl";
import { UserLocationMarker } from "../components/map/UserLocationMarker";
import { MapClickHandler } from "../components/map/MapClickHandler";
import { MapMoveHandler } from "../components/map/MapMoveHandler";
import { MapResizeHandler } from "../components/map/MapResizeHandler";
import { LocationPopup } from "../components/map/LocationPopup";
import { SavedLocationMarkers } from "../components/map/SavedLocationMarkers";
import { WarningOverlay } from "../components/map/WarningOverlay";
import { RainRadarOverlay } from "../components/map/RainRadarOverlay";
import { RadarControls } from "../components/map/RadarControls";
import { LocationSearch } from "../components/LocationSearch";
import { LocationListView } from "../components/LocationListView";
import { CurrentWeatherCard } from "../components/weather/CurrentWeatherCard";
import { ForecastStrip } from "../components/weather/ForecastStrip";
import { HourlyForecast } from "../components/weather/HourlyForecast";
import { useWeatherSnapshot } from "../hooks/useWeather";
import { useSavedLocations } from "../hooks/useSavedLocations";
import { useDefaultCenter } from "../hooks/useDefaultCenter";
import { useGeolocationStore } from "../stores/geolocation";
import { useMapStore } from "../stores/map";
import "../components/weather/Weather.css";
import "./Map.css";

const EMPTY_LOCATIONS: import("@reissulla/shared").SavedLocation[] = [];

type ForecastTab = "days" | "hourly";

export function MapPage() {
  const intl = useIntl();
  const [forecastTab, setForecastTab] = useState<ForecastTab>("days");
  const view = useMapStore((s) => s.view);
  const setView = useMapStore((s) => s.setView);
  const geoPosition = useGeolocationStore((s) => s.position);
  const geoDenied = useGeolocationStore((s) => s.denied);

  const selectedLocation = useMapStore((s) => s.selectedLocation);
  const searchResults = useMapStore((s) => s.searchResults);
  const followMe = useMapStore((s) => s.followMe);
  const selectLocation = useMapStore((s) => s.selectLocation);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setSearchResults = useMapStore((s) => s.setSearchResults);

  const { center: defaultCenter, zoom: defaultZoom } = useDefaultCenter();
  const savedLocations = useSavedLocations();

  // Weather is shown for: selected location > GPS position > null
  const weatherTarget = selectedLocation ?? geoPosition;

  const snapshot = useWeatherSnapshot(
    weatherTarget?.lat ?? null,
    weatherTarget?.lon ?? null,
  );
  const current = snapshot.data?.data.current ?? undefined;
  const daily = snapshot.data?.data.forecast?.daily;
  const hourly = snapshot.data?.data.forecast?.hourly;
  const nowcast = snapshot.data?.data.nowcast ?? null;

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
    (reverseQuery.isLoading
      ? undefined
      : intl.formatMessage({ id: "map.popup.unnamedLocation" }));

  // Short label for the weather panel heading
  const weatherLocationName = selectedLocation
    ? (selectedLocation.name?.split(",")[0] ??
      reverseQuery.data?.data.name ??
      intl.formatMessage({ id: "map.weather.heading.selectedFallback" }))
    : geoPosition
      ? intl.formatMessage({ id: "map.weather.heading.you" })
      : null;

  return (
    <div className="page-full-width map-page">
      <h2 className="visually-hidden" id="map-heading">
        <FormattedMessage id="map.heading" />
      </h2>

      {geoDenied && (
        <div className="gps-banner" role="status">
          <FormattedMessage id="map.banner.allowAccess" />
        </div>
      )}

      {/* View toggle — positioned at bottom center */}
      <div
        role="tablist"
        aria-label={intl.formatMessage({ id: "map.viewToggle.label" })}
        className="view-toggle"
      >
        <button
          id="tab-map"
          role="tab"
          aria-selected={view === "map"}
          aria-controls="panel-map"
          onClick={() => setView("map")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <FormattedMessage id="map.tab.map" />
        </button>
        <button
          id="tab-list"
          role="tab"
          aria-selected={view === "list"}
          aria-controls="panel-list"
          onClick={() => setView("list")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <FormattedMessage id="map.tab.list" />
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
          <div
            className="weather-panel"
            aria-label={intl.formatMessage({ id: "map.weather.panelLabel" })}
          >
            {weatherLocationName && (
              <p className="weather-panel__heading">{weatherLocationName}</p>
            )}
            <CurrentWeatherCard
              data={current ?? undefined}
              isLoading={snapshot.isLoading}
              isError={snapshot.isError && !current}
              isStale={snapshot.isStale}
              dataUpdatedAt={snapshot.dataUpdatedAt}
              onRetry={snapshot.refetch}
            />
            <div
              role="tablist"
              aria-label={intl.formatMessage({
                id: "map.weather.forecastTabs.label",
              })}
              className="weather-panel__forecast-tabs"
            >
              <button
                id="tab-forecast-days"
                role="tab"
                type="button"
                aria-selected={forecastTab === "days"}
                aria-controls="panel-forecast-days"
                tabIndex={forecastTab === "days" ? 0 : -1}
                onClick={() => setForecastTab("days")}
              >
                <FormattedMessage id="map.weather.forecastTab.days" />
              </button>
              <button
                id="tab-forecast-hourly"
                role="tab"
                type="button"
                aria-selected={forecastTab === "hourly"}
                aria-controls="panel-forecast-hourly"
                tabIndex={forecastTab === "hourly" ? 0 : -1}
                onClick={() => setForecastTab("hourly")}
              >
                <FormattedMessage id="map.weather.forecastTab.hourly" />
              </button>
            </div>
            <div
              id="panel-forecast-days"
              role="tabpanel"
              aria-labelledby="tab-forecast-days"
              hidden={forecastTab !== "days"}
            >
              <ForecastStrip
                days={daily}
                isLoading={snapshot.isLoading}
                isError={snapshot.isError && !daily}
              />
            </div>
            <div
              id="panel-forecast-hourly"
              role="tabpanel"
              aria-labelledby="tab-forecast-hourly"
              hidden={forecastTab !== "hourly"}
            >
              <HourlyForecast
                hours={hourly}
                isLoading={snapshot.isLoading}
                isError={snapshot.isError && !hourly}
                tableOnly
              />
            </div>
          </div>
        )}

        <LayerControl />
        <FollowMeToggle />
        <RadarControls />

        <LeafletMap center={defaultCenter} zoom={defaultZoom}>
          <MapResizeHandler visible={view === "map"} />
          <MapMoveHandler />
          <MapShareUrl />
          <MapFollowMe />
          <WarningOverlay />
          <RainRadarOverlay flavor={nowcast?.flavor} />
          {selectedLocation && !followMe && (
            <MapFlyTo lat={selectedLocation.lat} lon={selectedLocation.lon} />
          )}
          {geoPosition && (
            <UserLocationMarker position={[geoPosition.lat, geoPosition.lon]} />
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
          savedLocations={savedLocations.data?.data ?? EMPTY_LOCATIONS}
        />
      </div>
    </div>
  );
}
