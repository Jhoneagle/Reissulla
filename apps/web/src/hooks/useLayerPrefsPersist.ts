import { useCallback } from "react";
import type { LayerDefaults, LayerId } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";
import { usePreferences, useUpdatePreferences } from "./usePreferences";

/**
 * Persist the user's map layer choice to the server for authenticated
 * users. Anonymous users round-trip through localStorage in the MapStore
 * itself; this hook is a no-op for them.
 *
 * The preferences endpoint replaces `extra` whole-cloth on PATCH, so we
 * read the current `extra` and merge `layerDefaults` into it before
 * sending. Persona, banner-dismissed, etc. survive a layer change.
 */
export function useLayerPrefsPersist() {
  const user = useAuthStore((s) => s.user);
  const prefs = usePreferences().data;
  const update = useUpdatePreferences();

  return useCallback(
    (baseLayer: LayerId, overlays: readonly LayerId[]) => {
      if (!user) return;
      const layerDefaults: LayerDefaults = {
        baseLayer,
        overlays: [...overlays],
      };
      update.mutate({
        extra: {
          ...(prefs?.extra ?? {}),
          layerDefaults,
        },
      });
    },
    [user, prefs?.extra, update],
  );
}
