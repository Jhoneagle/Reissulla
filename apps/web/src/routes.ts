import { Dashboard } from "./pages/Dashboard";
import { MapPage } from "./pages/Map";
import { Transit } from "./pages/Transit";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

export const routes = [
  { path: "/", label: "Dashboard", Component: Dashboard, nav: true },
  { path: "/map", label: "Map", Component: MapPage, nav: true },
  { path: "/transit", label: "Transit", Component: Transit, nav: true },
  { path: "/settings", label: "Settings", Component: Settings, nav: true },
  { path: "/login", label: "Log in", Component: Login, nav: false },
  { path: "/register", label: "Register", Component: Register, nav: false },
] as const;

export const navRoutes = routes.filter((r) => r.nav);
