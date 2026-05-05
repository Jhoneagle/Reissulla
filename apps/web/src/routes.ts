import { Dashboard } from "./pages/Dashboard";
import { MapPage } from "./pages/Map";
import { Transit } from "./pages/Transit";
import { Settings } from "./pages/Settings";

export const routes = [
  { path: "/", label: "Dashboard", Component: Dashboard },
  { path: "/map", label: "Map", Component: MapPage },
  { path: "/transit", label: "Transit", Component: Transit },
  { path: "/settings", label: "Settings", Component: Settings },
] as const;
