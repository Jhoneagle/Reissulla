import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server.js";
import { clearCapturedRequests, recordRequest } from "./msw/request-log.js";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });

  // Mirror every request into the capture log so tests can assert on URL
  // parameters (e.g. departure direction) without each handler having to
  // call recordRequest manually.
  server.events.on("request:start", ({ request }) => {
    recordRequest({
      url: request.url,
      method: request.method,
      body: null,
    });
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearCapturedRequests();
});

afterAll(() => {
  server.close();
});
