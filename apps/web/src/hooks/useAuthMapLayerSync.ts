import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { useMapStore } from "../stores/map";
import { usePreferences } from "./usePreferences";

const SHARE_URL_PARAMS = ["base", "overlays", "lat", "lon", "z"] as const;

function hasShareUrlParams(): boolean {
  if (typeof window === "undefined") return false;
  const sp = new URLSearchParams(window.location.search);
  return SHARE_URL_PARAMS.some((p) => sp.has(p));
}

/**
 * Hydrate the map base-layer + overlay selection from the signed-in user's
 * `preferences.extra.layerDefaults` on auth.
 *
 * Anon→auth merge rule: server prefs win over the anon localStorage default
 * — but a share URL outranks both. If the user landed via a link that
 * carries map state (lat/lon/z/base/overlays), MapShareUrl has already
 * applied that URL state; we must not overwrite it with prefs here, or
 * shared map links wouldn't survive a logged-in user opening them.
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
    if (hasShareUrlParams()) return;
    useMapStore.getState().hydrateFromPreferences(layerDefaults);
  }, [user, layerDefaults]);
}
