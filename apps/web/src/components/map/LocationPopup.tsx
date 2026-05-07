import { Marker, Popup } from "react-leaflet";
import { useCurrentWeather } from "../../hooks/useWeather";
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
  const { data, isLoading, isError } = useCurrentWeather(
    position[0],
    position[1],
  );

  return (
    <Marker position={position}>
      <Popup eventHandlers={{ remove: onClose }}>
        <div className="location-popup">
          {loading ? (
            <p className="popup-loading">Loading location...</p>
          ) : (
            <h3>{name ?? "Selected location"}</h3>
          )}
          <p className="popup-coords">
            {position[0].toFixed(4)}, {position[1].toFixed(4)}
          </p>
          <PopupWeather
            data={data?.data}
            isLoading={isLoading}
            isError={isError}
          />
        </div>
      </Popup>
    </Marker>
  );
}
