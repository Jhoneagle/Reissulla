import { Marker, Popup } from "react-leaflet";
import { Link } from "react-router";
import { useCurrentWeather } from "../../hooks/useWeather";
import {
  useIsLocationSaved,
  useSaveLocation,
  useDeleteLocation,
} from "../../hooks/useSavedLocations";
import { useAuthStore } from "../../stores/auth";
import { PopupWeather } from "../weather/PopupWeather";

interface LocationPopupProps {
  position: [number, number];
  name?: string;
  loading: boolean;
  onClose: () => void;
}

export function LocationPopup({
  position,
  name,
  loading,
  onClose,
}: LocationPopupProps) {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useCurrentWeather(
    position[0],
    position[1],
  );

  const savedId = useIsLocationSaved(position[0], position[1]);
  const saveLocation = useSaveLocation();
  const deleteLocation = useDeleteLocation();

  const locationName = name ?? "Selected location";
  const isSaving = saveLocation.isPending || deleteLocation.isPending;
  const saveError = saveLocation.isError || deleteLocation.isError;

  const handleSave = () => {
    if (savedId) {
      deleteLocation.mutate(savedId);
    } else {
      saveLocation.mutate({
        name: locationName,
        latitude: position[0],
        longitude: position[1],
      });
    }
  };

  return (
    <Marker position={position}>
      <Popup eventHandlers={{ remove: onClose }}>
        <div className="location-popup">
          {loading ? (
            <p className="popup-loading">Loading location...</p>
          ) : (
            <h3>{locationName}</h3>
          )}
          <p className="popup-coords">
            {position[0].toFixed(4)}, {position[1].toFixed(4)}
          </p>
          <PopupWeather
            data={data?.data}
            isLoading={isLoading}
            isError={isError}
          />
          <div className="popup-save">
            {user ? (
              <>
                <button
                  type="button"
                  className={`popup-save__btn${savedId ? " popup-save__btn--saved" : ""}`}
                  onClick={handleSave}
                  disabled={isSaving || loading}
                >
                  {savedId ? "Saved" : "Save location"}
                </button>
                {saveError && (
                  <p className="popup-save__error">Failed to save — try again</p>
                )}
              </>
            ) : (
              <p className="popup-save__prompt">
                <Link to="/login">Log in</Link> to save locations
              </p>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
