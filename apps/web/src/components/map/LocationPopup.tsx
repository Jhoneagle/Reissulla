import { Marker, Popup } from "react-leaflet";

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
        </div>
      </Popup>
    </Marker>
  );
}
