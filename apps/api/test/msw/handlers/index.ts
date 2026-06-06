import { openMeteoHandlers } from "./open-meteo.js";
import { openMeteoAirQualityHandlers } from "./open-meteo-air-quality.js";
import { fmiHandlers } from "./fmi.js";
import { fintrafficHandlers } from "./fintraffic.js";
import { digitransitRoutingHandlers } from "./digitransit-routing.js";
import { digitransitPeliasHandlers } from "./digitransit-pelias.js";
import { recaptchaHandlers } from "./recaptcha.js";

export const externalHandlers = [
  ...openMeteoHandlers,
  ...openMeteoAirQualityHandlers,
  ...fmiHandlers,
  ...fintrafficHandlers,
  ...digitransitRoutingHandlers,
  ...digitransitPeliasHandlers,
  ...recaptchaHandlers,
];

export { SYNTHETIC_ROUTING_BASE } from "./digitransit-routing.js";
