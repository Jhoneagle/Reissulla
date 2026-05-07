import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface MapFlyToProps {
  lat: number;
  lon: number;
}

export function MapFlyTo({ lat, lon }: MapFlyToProps) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([lat, lon]);
  }, [map, lat, lon]);

  return null;
}
