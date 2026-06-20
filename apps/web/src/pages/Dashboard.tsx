import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import type { SavedLocation } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";
import { useGeolocationStore } from "../stores/geolocation";
import { useSavedLocations } from "../hooks/useSavedLocations";
import { LocationCard } from "../components/dashboard/LocationCard";
import { PinnedStopsCard } from "../components/dashboard/PinnedStopsCard";
import { PinnedLinesCard } from "../components/dashboard/PinnedLinesCard";
import { SuggestPinCard } from "../components/dashboard/SuggestPinCard";
import { RecentItinerariesCard } from "../components/dashboard/RecentItinerariesCard";
import { SaveCurrentLocationPrompt } from "../components/dashboard/SaveCurrentLocationPrompt";
import { DashboardKicker } from "../components/dashboard/DashboardKicker";
import { TodayAlerts } from "../components/dashboard/TodayAlerts";
import { RegionStatusCard } from "../components/dashboard/RegionStatusCard";
import { SatelliteArt } from "../components/art/EmptyArt";

/**
 * Dashboard composition (roadmap DASH-1, DASH-2, DASH-8, DASH-9):
 *
 * - Authenticated with saved locations: primary card at the top, secondary
 *   cards below ordered by sortOrder.
 * - Authenticated with no saved locations: anonymous-style GPS card with
 *   the "save this place" affordance to bootstrap the user's list.
 * - Anonymous: GPS card with weather + nearest stops, no save affordance.
 *   The auth-nav already nudges them toward register/login.
 * - No saved locations + no GPS: a short empty-state explaining how to
 *   proceed.
 *
 * Cards render client-side and parallelise their own fetches (weather +
 * nearby stops). The page itself stays a thin layout shell.
 *
 * Reorderable widgets (DASH-10) reuse the existing sortOrder on saved
 * locations — users reorder from the Settings → Saved Locations manager.
 * A per-dashboard custom widget order is deferred until there's evidence
 * the user wants something other than the saved-list order.
 */
export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const geolocation = useGeolocationStore();
  const savedQuery = useSavedLocations();

  const savedLocations = savedQuery.data?.data ?? [];
  const primary = savedLocations.find((l) => l.isPrimary);
  const secondary = savedLocations.filter((l) => l !== primary);

  const gps = geolocation.position;

  return (
    <div className="dashboard">
      <DashboardKicker />

      {!user && (
        <p className="help">
          <FormattedMessage id="dashboard.signedOutIntro" />
        </p>
      )}

      {user && <TodayAlerts />}

      {primary ? (
        <PrimaryCard location={primary} />
      ) : gps ? (
        <GpsCard lat={gps.lat} lon={gps.lon} />
      ) : (
        <EmptyState authed={!!user} />
      )}

      <PinnedStopsCard />
      <PinnedLinesCard />

      {secondary.length > 0 && (
        <div className="dashboard-grid">
          {secondary.map((loc) => (
            <LocationCard
              key={loc.id}
              lat={loc.latitude}
              lon={loc.longitude}
              name={loc.name}
              region={loc.region}
              savedId={loc.id}
            />
          ))}
        </div>
      )}

      {user && (
        <div className="dashboard-history-grid">
          <SuggestPinCard />
          <RecentItinerariesCard />
        </div>
      )}

      {user && <RegionStatusCard />}

      {user && savedLocations.length === 0 && gps && (
        <SaveCurrentLocationPrompt lat={gps.lat} lon={gps.lon} />
      )}
    </div>
  );
}

function PrimaryCard({ location }: { location: SavedLocation }) {
  return (
    <LocationCard
      lat={location.latitude}
      lon={location.longitude}
      name={location.name}
      region={location.region}
      isPrimary
      savedId={location.id}
    />
  );
}

function GpsCard({ lat, lon }: { lat: number; lon: number }) {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  return (
    <>
      <LocationCard
        lat={lat}
        lon={lon}
        name={intl.formatMessage({ id: "dashboard.currentLocation" })}
        isPrimary
      />
      {user && <SaveCurrentLocationPrompt lat={lat} lon={lon} />}
    </>
  );
}

function EmptyState({ authed }: { authed: boolean }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state__art empty-state__art--lg" aria-hidden="true">
        <SatelliteArt />
      </div>
      <p className="empty-state__phrase">
        <FormattedMessage id="dashboard.gpsUnavailable" />
      </p>
      {authed && (
        <Link to="/map" className="btn btn--primary">
          <FormattedMessage id="dashboard.gpsUnavailable.cta" />
        </Link>
      )}
    </div>
  );
}
