import { useMapEvents } from "react-leaflet";

interface MapClickHandlerProps {
  onClick: (lat: number, lon: number) => void;
}

export function MapClickHandler({ onClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
