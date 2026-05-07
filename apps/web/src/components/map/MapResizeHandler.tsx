import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface MapResizeHandlerProps {
  visible: boolean;
}

export function MapResizeHandler({ visible }: MapResizeHandlerProps) {
  const map = useMap();

  useEffect(() => {
    if (visible) {
      map.invalidateSize();
    }
  }, [map, visible]);

  return null;
}
