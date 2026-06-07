import { config } from "../config.js";

export interface FeatureFlags {
  feed: {
    finland: boolean;
    hsl: boolean;
    waltti: boolean;
    varely: boolean;
  };
  /**
   * Behaviour-level kill switches. `realtimeSse` gates every `/api/v1/.../live`
   * endpoint and the surrounding bus + registry — off by default so a misbehaving
   * upstream can be parked at the env-var layer without a code change. Other
   * `feature.*` flags land alongside their owning phase per
   * `docs/architecture.md` §12.
   */
  feature: {
    realtimeSse: boolean;
  };
}

export function getFeatureFlags(): FeatureFlags {
  return {
    feed: {
      finland: config.feedFinlandEnabled,
      hsl: config.feedHslEnabled,
      waltti: config.feedWalttiEnabled,
      varely: config.feedVarelyEnabled,
    },
    feature: {
      realtimeSse: config.realtimeSseEnabled,
    },
  };
}
