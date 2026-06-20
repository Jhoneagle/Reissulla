import { Dashboard } from "./pages/Dashboard";
import { MapPage } from "./pages/Map";
import { Transit } from "./pages/Transit";
import { TripDetail } from "./pages/TripDetail";
import { LineView } from "./pages/LineView";
import { SharedItinerary } from "./pages/SharedItinerary";
import { Settings } from "./pages/Settings";
import { Notifications } from "./pages/Notifications";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

// `labelId` is the i18n message key the Layout resolves via FormattedMessage.
// `label` is the English fallback used when no IntlProvider is mounted
// (e.g. in tests that bypass <App>).
export const routes = [
  {
    path: "/",
    label: "Dashboard",
    labelId: "nav.dashboard",
    Component: Dashboard,
    nav: true,
  },
  {
    path: "/map",
    label: "Map",
    labelId: "nav.map",
    Component: MapPage,
    nav: true,
  },
  {
    path: "/transit/trip/:tripId",
    label: "Trip",
    labelId: "transit.trip.heading",
    Component: TripDetail,
    nav: false,
  },
  {
    path: "/transit/line/:gtfsId",
    label: "Line",
    labelId: "transit.line.heading",
    Component: LineView,
    nav: false,
  },
  {
    path: "/transit",
    label: "Transit",
    labelId: "nav.transit",
    Component: Transit,
    nav: true,
  },
  {
    path: "/t",
    label: "Shared trip",
    labelId: "transit.itinerary.share.viewHeading",
    Component: SharedItinerary,
    nav: false,
  },
  {
    path: "/settings",
    label: "Settings",
    labelId: "nav.settings",
    Component: Settings,
    nav: true,
  },
  {
    path: "/notifications",
    label: "Notifications",
    labelId: "notifications.heading",
    Component: Notifications,
    nav: false,
  },
  {
    path: "/login",
    label: "Log in",
    labelId: "nav.logIn",
    Component: Login,
    nav: false,
  },
  {
    path: "/register",
    label: "Register",
    labelId: "nav.register",
    Component: Register,
    nav: false,
  },
] as const;

export const navRoutes = routes.filter((r) => r.nav);
