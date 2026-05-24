import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { routes } from "./routes";
import { useAuthStore } from "./stores/auth";
import { useGeolocationStore } from "./stores/geolocation";
import { useAuthLocaleSync } from "./hooks/useAuthLocaleSync";
import { useAuthCacheCleanup } from "./hooks/useAuthCacheCleanup";
import { useTheme } from "./hooks/useTheme";
import { I18nShell } from "./i18n";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export function App() {
  useEffect(() => {
    useAuthStore.getState().initialize();
    useGeolocationStore.getState().requestPosition();
  }, []);

  return (
    <I18nShell>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </QueryClientProvider>
    </I18nShell>
  );
}

/**
 * Inside QueryClientProvider so the locale-sync hook can use react-query
 * (usePreferences). Outside the route Outlet so the sync runs regardless
 * of which page is mounted.
 */
function AppShell() {
  useAuthLocaleSync();
  useAuthCacheCleanup();
  useTheme();
  return (
    <Routes>
      <Route element={<Layout />}>
        {routes.map(({ path, Component }) => (
          <Route
            key={path}
            index={path === "/"}
            path={path === "/" ? undefined : path.slice(1)}
            element={<Component />}
          />
        ))}
      </Route>
    </Routes>
  );
}
