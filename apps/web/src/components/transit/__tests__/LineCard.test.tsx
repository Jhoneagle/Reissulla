import { HttpResponse, delay, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type {
  FrequencyBand,
  LineStopDeparture,
  LineView as LineViewData,
} from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { LineCard } from "../LineCard";
import { server } from "../../../test/msw/server";
import { getCapturedRequests } from "../../../test/msw/request-log";

vi.mock("../../../stores/auth", () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: null }),
}));

vi.mock("../../../stores/toast", () => ({ showToast: vi.fn() }));

function lineFixture(over: Partial<LineViewData> = {}): LineViewData {
  return {
    gtfsId: "HSL:1025",
    shortName: "25",
    longName: "Kamppi – Itäkeskus",
    mode: "BUS",
    color: null,
    textColor: null,
    agency: { gtfsId: "HSL", name: "HSL" },
    region: "HSL",
    patterns: [
      {
        code: "HSL:1025:0:01",
        headsign: "Itäkeskus",
        directionId: 0,
        stops: [
          {
            gtfsId: "s1",
            name: "Kamppi",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s2",
            name: "Hakaniemi",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s3",
            name: "Itäkeskus",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
        ],
      },
      {
        code: "HSL:1025:1:01",
        headsign: "Kamppi",
        directionId: 1,
        stops: [
          {
            gtfsId: "s3",
            name: "Itäkeskus",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s4",
            name: "Sörnäinen",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
          {
            gtfsId: "s1",
            name: "Kamppi",
            lat: 0,
            lon: 0,
            code: null,
            platformCode: null,
          },
        ],
      },
    ],
    ...over,
  };
}

function band(over: Partial<FrequencyBand> = {}): FrequencyBand {
  return {
    fromTimeOfDay: "06:00",
    toTimeOfDay: "09:00",
    headwayMin: 10,
    tripCount: 18,
    ...over,
  };
}

function dep(over: Partial<LineStopDeparture> = {}): LineStopDeparture {
  return {
    stop: {
      gtfsId: "s1",
      name: "Kamppi",
      lat: 0,
      lon: 0,
      code: null,
      platformCode: null,
    },
    nextDepartureUnix: null,
    scheduledDepartureUnix: null,
    delaySec: 0,
    realtime: false,
    headwayMin: null,
    ...over,
  };
}

/** Default success handlers for the line/departures/frequency triple. */
function useSuccessHandlers(opts?: {
  departures?: LineStopDeparture[];
  frequency?: FrequencyBand[];
}) {
  server.use(
    http.get("*/api/v1/transit/lines/HSL%3A1025", () =>
      HttpResponse.json({ data: lineFixture(), cached: false }),
    ),
    http.get("*/api/v1/transit/lines/HSL%3A1025/departures", () =>
      HttpResponse.json({ data: opts?.departures ?? [], cached: false }),
    ),
    http.get("*/api/v1/transit/lines/HSL%3A1025/frequency", () =>
      HttpResponse.json({ data: opts?.frequency ?? [band()], cached: false }),
    ),
  );
}

beforeEach(() => {
  /* default handlers reset by afterEach in setup.ts */
});

describe("LineCard", () => {
  it("renders the loading plate while the line query is in flight", async () => {
    server.use(
      http.get("*/api/v1/transit/lines/HSL%3A1025", async () => {
        await delay(500);
        return HttpResponse.json({ data: lineFixture(), cached: false });
      }),
    );
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);
    expect(document.querySelector(".line-card--loading")).not.toBeNull();
  });

  it("renders a not-found state with no retry when 404", async () => {
    server.use(
      http.get("*/api/v1/transit/lines/HSL%3A1025", () =>
        HttpResponse.json(
          { error: { code: "LINE_NOT_FOUND", message: "not found" } },
          { status: 404 },
        ),
      ),
    );
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);

    await waitFor(() => {
      expect(screen.getByText(/line not found/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("renders masthead, direction toggle, frequency strip, and stops", async () => {
    useSuccessHandlers({
      departures: [
        dep({ nextDepartureUnix: Math.floor(Date.now() / 1000) + 300 }),
      ],
    });
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("group", { name: /direction/i }),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll(".freq-strip__bar").length,
    ).toBeGreaterThan(0);
  });

  it("renders an em-dash placeholder for stops with no upcoming departure", async () => {
    useSuccessHandlers();
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });
    // Three stops, none with departure data → at least two em-dashes
    // (the third is the terminus, which renders the terminus label).
    const dashes = document.querySelectorAll(".line-card__none");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onDirectionChange when direction toggle is activated (controlled)", async () => {
    useSuccessHandlers();
    const onDirectionChange = vi.fn();
    renderWithProviders(
      <LineCard
        gtfsId="HSL:1025"
        direction={0}
        onDirectionChange={onDirectionChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /kamppi/i }));
    expect(onDirectionChange).toHaveBeenCalledWith(1);
  });

  it("flips its own dir state when uncontrolled", async () => {
    useSuccessHandlers();
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /kamppi/i }));

    // After the flip, the line-departures query refires with direction=1.
    await waitFor(() => {
      const departuresCalls = getCapturedRequests().filter((r) =>
        r.url.includes("/lines/HSL%3A1025/departures"),
      );
      expect(departuresCalls.some((r) => r.url.includes("direction=1"))).toBe(
        true,
      );
    });
  });

  it("renders the fineprint when showFineprint is set", async () => {
    useSuccessHandlers();
    renderWithProviders(<LineCard gtfsId="HSL:1025" showFineprint />);

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });
    expect(document.querySelector(".line-card__fineprint")).not.toBeNull();
  });

  it("omits the fineprint by default", async () => {
    useSuccessHandlers();
    renderWithProviders(<LineCard gtfsId="HSL:1025" />);

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });
    expect(document.querySelector(".line-card__fineprint")).toBeNull();
  });
});
