/**
 * MQTT WSS client placeholder. Chunk 3 lands the real connection logic
 * (HSL broker via `wss://mqtt.hsl.fi:443/`, reconnect with backoff,
 * fallback to long-polled `vehiclePositions(...)` after 60 s of failure).
 *
 * Phase 4 Chunk 1 keeps this file empty so the directory is structurally
 * complete — `index.ts` ships the contract + a no-op stub adapter.
 */
export {};
