import { openMeteoHandlers } from "./open-meteo.js";
import { digitransitRoutingHandlers } from "./digitransit-routing.js";
import { digitransitPeliasHandlers } from "./digitransit-pelias.js";
import { recaptchaHandlers } from "./recaptcha.js";

export const externalHandlers = [
  ...openMeteoHandlers,
  ...digitransitRoutingHandlers,
  ...digitransitPeliasHandlers,
  ...recaptchaHandlers,
];

export { SYNTHETIC_ROUTING_BASE } from "./digitransit-routing.js";
