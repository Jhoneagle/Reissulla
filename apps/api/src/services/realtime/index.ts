/**
 * Barrel that loads the channel modules so their `registerChannelFactory()`
 * side effects run before any route handler asks the registry for a channel.
 * Routes import this module — not the individual channel files — so the
 * registration set stays one edit away from "what's in this barrel".
 */
import "./channels/stop-departures.channel.js";
import "./channels/line-vehicles.channel.js";
import "./channels/alerts.channel.js";

export { registry, createRegistry } from "./registry.js";
export type { Channel, ChannelKey, ChannelRegistry } from "./channels.js";
export { InMemoryBus, RedisPubSubBus, type RealtimeBus } from "./bus.js";
