import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../test/msw/server.js";
import { useFeatureFlags } from "./useFeatureFlags";
import type { ReactNode } from "react";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useFeatureFlags", () => {
  it("returns the safe default before the first response lands", () => {
    server.use(
      http.get("*/api/v1/me/feature-flags", () => HttpResponse.json({})),
    );
    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.feature.realtimeSse).toBe(false);
  });

  it("reflects the server's realtimeSse flag once it has been fetched", async () => {
    server.use(
      http.get("*/api/v1/me/feature-flags", () =>
        HttpResponse.json({ feature: { realtimeSse: true } }),
      ),
    );

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => {
      expect(result.current.feature.realtimeSse).toBe(true);
    });
  });
});
