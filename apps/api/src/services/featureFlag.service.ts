import { config } from "../config.js";

export interface FeatureFlags {
  feed: {
    finland: boolean;
    hsl: boolean;
  };
}

export function getFeatureFlags(): FeatureFlags {
  return {
    feed: {
      finland: config.feedFinlandEnabled,
      hsl: config.feedHslEnabled,
    },
  };
}
