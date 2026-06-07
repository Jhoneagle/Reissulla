import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { useMapStore } from "../stores/map";
import { usePreferences } from "./usePreferences";

/**
 * Hydrate the map base-layer + overlay selection from the signed-in user's
 * `preferences.extra.layerDefaults` on auth.
 *
 * Anon→auth merge rule: server prefs win. The MapStore's anon localStorage
 * is overwritten so the next anon session inherits the signed-in user's
 * last choice. See `hydrateFromPreferences` in `stores/map.ts`.
 *
 * Loop-free: this hook only writes into the MapStore — it never mutates
 * server prefs, so a server-driven update can't bounce back through here.
 * The LayerControl writes the patch separately (see commit 2).
 */
export function useAuthMapLayerSync(): void {
  const user = useAuthStore((s) => s.user);
  const prefs = usePreferences().data;
  const layerDefaults = prefs?.extra.layerDefaults;

  useEffect(() => {
    if (!user || !layerDefaults) return;
    useMapStore.getState().hydrateFromPreferences(layerDefaults);
  }, [user, layerDefaults]);
}
