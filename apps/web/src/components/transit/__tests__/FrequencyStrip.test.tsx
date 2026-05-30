import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { FrequencyBand } from "@reissulla/shared";
import { renderWithProviders } from "../../../test/test-utils";
import { FrequencyStrip } from "../FrequencyStrip";

function band(over: Partial<FrequencyBand> = {}): FrequencyBand {
  return {
    fromTimeOfDay: "06:00",
    toTimeOfDay: "09:00",
    headwayMin: 10,
    tripCount: 18,
    ...over,
  };
}

function renderStrip(bands: FrequencyBand[]) {
  const onDayTypeChange = vi.fn();
  const utils = renderWithProviders(
    <FrequencyStrip
      bands={bands}
      modeToken="bus"
      dayType="weekday"
      onDayTypeChange={onDayTypeChange}
    />,
  );
  return { ...utils, onDayTypeChange };
}

describe("FrequencyStrip", () => {
  it("renders one bar column per band", () => {
    renderStrip([
      band({ fromTimeOfDay: "06:00", toTimeOfDay: "09:00", headwayMin: 7 }),
      band({ fromTimeOfDay: "09:00", toTimeOfDay: "15:00", headwayMin: 12 }),
      band({ fromTimeOfDay: "15:00", toTimeOfDay: "20:00", headwayMin: 6 }),
    ]);
    const bars = document.querySelectorAll(".freq-strip__bar");
    expect(bars).toHaveLength(3);
  });

  it("scales bar height inversely with headway", () => {
    renderStrip([
      band({ fromTimeOfDay: "06:00", toTimeOfDay: "09:00", headwayMin: 5 }),
      band({ fromTimeOfDay: "09:00", toTimeOfDay: "15:00", headwayMin: 20 }),
    ]);
    const bars = Array.from(
      document.querySelectorAll<HTMLDivElement>(".freq-strip__bar"),
    );
    const denseHeight = parseInt(bars[0]!.style.height, 10);
    const sparseHeight = parseInt(bars[1]!.style.height, 10);
    expect(denseHeight).toBeGreaterThan(sparseHeight);
  });

  it("marks the active day-type with aria-current page", () => {
    renderStrip([band()]);
    const weekday = screen.getByRole("button", { name: /weekdays/i });
    const saturday = screen.getByRole("button", { name: /saturday/i });
    expect(weekday).toHaveAttribute("aria-current", "page");
    expect(saturday).not.toHaveAttribute("aria-current");
  });

  it("calls onDayTypeChange when a tab is activated", () => {
    const { onDayTypeChange } = renderStrip([band()]);
    fireEvent.click(screen.getByRole("button", { name: /sunday/i }));
    expect(onDayTypeChange).toHaveBeenCalledWith("sunday");
  });

  it("renders the empty placeholder when no bands are provided", () => {
    renderStrip([]);
    expect(
      screen.getByText(/no timetable data available/i),
    ).toBeInTheDocument();
    expect(document.querySelectorAll(".freq-strip__bar")).toHaveLength(0);
  });

  it("renders the sparse-day caption for headwayMin === -1 with no bar grid", () => {
    renderStrip([
      band({
        fromTimeOfDay: "05:00",
        toTimeOfDay: "22:00",
        headwayMin: -1,
        tripCount: 4,
        tripTimes: ["05:42", "12:18", "17:05", "21:30"],
      }),
    ]);
    const sparse = screen.getByTestId("freq-strip-sparse");
    expect(sparse).toHaveTextContent("05:42");
    expect(sparse).toHaveTextContent("21:30");
    expect(document.querySelectorAll(".freq-strip__bar")).toHaveLength(0);
  });

  it("does NOT collapse headwayMin === 0 into the sparse path", () => {
    renderStrip([band({ headwayMin: 0 })]);
    // Bar grid still renders; sparse caption does not.
    expect(document.querySelectorAll(".freq-strip__bar")).toHaveLength(1);
    expect(screen.queryByTestId("freq-strip-sparse")).not.toBeInTheDocument();
  });

  it("emits per-band SR narrative sentences in DOM order before the grid", () => {
    renderStrip([
      band({ fromTimeOfDay: "06:00", toTimeOfDay: "09:00", headwayMin: 7 }),
      band({ fromTimeOfDay: "09:00", toTimeOfDay: "15:00", headwayMin: 12 }),
    ]);
    const srSentences = document.querySelectorAll(
      ".visually-hidden",
    ) as NodeListOf<HTMLElement>;
    expect(srSentences.length).toBeGreaterThanOrEqual(2);
    expect(srSentences[0]!.textContent).toContain("06:00");
    expect(srSentences[0]!.textContent).toContain("7");
    expect(srSentences[1]!.textContent).toContain("09:00");
    expect(srSentences[1]!.textContent).toContain("12");
  });

  it("renders the mobile headway disclosure alongside the desktop caption", () => {
    renderStrip([band({ headwayMin: 8 })]);
    const column = document.querySelector(".freq-strip__column")!;
    const details = within(column as HTMLElement).getByText(/every 8 min/i, {
      selector: "summary",
    });
    expect(details.tagName).toBe("SUMMARY");
    expect(details.closest("details")).toHaveClass(
      "freq-strip__headway-mobile",
    );
    const desktop = within(column as HTMLElement).getAllByText(/every 8 min/i);
    // One inside <summary>, one inside the desktop span.
    expect(desktop.length).toBeGreaterThanOrEqual(2);
  });
});
