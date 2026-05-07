import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { routes } from "./routes";
import { useAuthStore } from "./stores/auth";
import { useGeolocationStore } from "./stores/geolocation";
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
