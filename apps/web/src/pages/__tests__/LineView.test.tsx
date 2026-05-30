import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "../../test/test-utils";
import { LineView } from "../LineView";

// LineView is now a thin shell over <LineCard>. Stub LineCard so the page
// test stays focused on shell concerns (back link, URL → prop wiring),
// and leave the body coverage to LineCard.test.tsx.
vi.mock("../../components/transit/LineCard", () => ({
  LineCard: (props: Record<string, unknown>) => (
    <div
      data-testid="line-card"
      data-gtfsid={props.gtfsId as string}
      data-direction={String(props.direction)}
      data-daytype={String(props.dayType)}
      data-showfineprint={String(props.showFineprint)}
    />
  ),
}));

function renderRoute(initialEntries: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/transit/line/:gtfsId" element={<LineView />} />
      <Route path="/transit/line" element={<LineView />} />
    </Routes>,
    { initialEntries },
  );
}

describe("LineView", () => {
  it("renders the back link, regardless of the URL", () => {
    renderRoute(["/transit/line/HSL%3A1025"]);
    expect(
      screen.getByRole("link", { name: /back to lines|takaisin/i }),
    ).toBeInTheDocument();
  });

  it("forwards the decoded gtfsId from the URL to LineCard", () => {
    renderRoute(["/transit/line/HSL%3A1025"]);
    const card = screen.getByTestId("line-card");
    expect(card).toHaveAttribute("data-gtfsid", "HSL:1025");
    expect(card).toHaveAttribute("data-showfineprint", "true");
  });

  it("forwards ?dir and ?dayType URL params to LineCard", () => {
    renderRoute(["/transit/line/HSL%3A1025?dir=1&dayType=saturday"]);
    const card = screen.getByTestId("line-card");
    expect(card).toHaveAttribute("data-direction", "1");
    expect(card).toHaveAttribute("data-daytype", "saturday");
  });

  it("falls back to dir=0 / dayType=weekday when the URL has none", () => {
    renderRoute(["/transit/line/HSL%3A1025"]);
    const card = screen.getByTestId("line-card");
    expect(card).toHaveAttribute("data-direction", "0");
    expect(card).toHaveAttribute("data-daytype", "weekday");
  });

  it("renders a not-found message and back link when gtfsId is missing", () => {
    renderRoute(["/transit/line"]);
    expect(screen.queryByTestId("line-card")).toBeNull();
    expect(screen.getByText(/line not found|linjaa ei l/i)).toBeInTheDocument();
  });
});
