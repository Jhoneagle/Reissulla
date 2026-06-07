import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { LiveIndicator } from "../LiveIndicator";
import enMessages from "../../../i18n/messages-en.json";

function renderWithIntl(state: "live" | "polling" | "error") {
  return render(
    <IntlProvider
      locale="en"
      messages={enMessages as Record<string, string>}
      defaultLocale="en"
    >
      <LiveIndicator state={state} />
    </IntlProvider>,
  );
}

describe("<LiveIndicator>", () => {
  it("renders the live state with its label and the success modifier class", () => {
    const { container } = renderWithIntl("live");
    expect(screen.getByText(/Live/i)).toBeInTheDocument();
    expect(
      container.querySelector(".live-indicator--live"),
    ).toBeInTheDocument();
  });

  it("renders the polling state with the 30 s refresh label", () => {
    const { container } = renderWithIntl("polling");
    expect(screen.getByText(/30 s/i)).toBeInTheDocument();
    expect(
      container.querySelector(".live-indicator--polling"),
    ).toBeInTheDocument();
  });

  it("renders the error state with the connection-lost label", () => {
    const { container } = renderWithIntl("error");
    expect(screen.getByText(/connection lost|retrying/i)).toBeInTheDocument();
    expect(
      container.querySelector(".live-indicator--error"),
    ).toBeInTheDocument();
  });

  it("marks the dot as aria-hidden — the text label carries semantics", () => {
    const { container } = renderWithIntl("live");
    const dot = container.querySelector(".live-indicator__dot");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });
});
