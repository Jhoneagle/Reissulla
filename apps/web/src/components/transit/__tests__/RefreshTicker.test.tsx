import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { RefreshTicker } from "../RefreshTicker";
import enMessages from "../../../i18n/messages-en.json";

function renderTicker(
  overrides: Partial<{
    choice: "live" | "30s" | "60s" | "off";
    showLiveUnavailable: boolean;
    onChoiceChange: (next: "live" | "30s" | "60s" | "off") => void;
  }> = {},
) {
  const onChoiceChange = overrides.onChoiceChange ?? vi.fn();
  render(
    <IntlProvider
      locale="en"
      messages={enMessages as Record<string, string>}
      defaultLocale="en"
    >
      <RefreshTicker
        choice={overrides.choice ?? "live"}
        onChoiceChange={onChoiceChange}
        showLiveUnavailable={overrides.showLiveUnavailable ?? false}
      />
    </IntlProvider>,
  );
  return { onChoiceChange };
}

describe("<RefreshTicker>", () => {
  it("renders all four cadence options inside a native details disclosure", () => {
    renderTicker();
    // The disclosure opens via the cog summary. Open it.
    const summary = screen.getByLabelText(/Refresh settings/i);
    summary.click();
    // The four options
    expect(screen.getByRole("radio", { name: /Live/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /30/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /60/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Off/i })).toBeInTheDocument();
  });

  it("checks the current choice's radio", () => {
    renderTicker({ choice: "60s" });
    screen.getByLabelText(/Refresh settings/i).click();
    expect(screen.getByRole("radio", { name: /60/i })).toBeChecked();
  });

  it("calls onChoiceChange when the user picks a new cadence", async () => {
    const user = userEvent.setup();
    const { onChoiceChange } = renderTicker({ choice: "live" });
    await user.click(screen.getByLabelText(/Refresh settings/i));
    await user.click(screen.getByRole("radio", { name: /Off/i }));
    expect(onChoiceChange).toHaveBeenCalledWith("off");
  });

  it("shows the live-unavailable notice only when showLiveUnavailable is true", () => {
    const { unmount } = render(
      <IntlProvider
        locale="en"
        messages={enMessages as Record<string, string>}
        defaultLocale="en"
      >
        <RefreshTicker
          choice="live"
          onChoiceChange={vi.fn()}
          showLiveUnavailable={false}
        />
      </IntlProvider>,
    );
    screen.getByLabelText(/Refresh settings/i).click();
    expect(
      screen.queryByText(/Live updates unavailable/i),
    ).not.toBeInTheDocument();
    unmount();

    renderTicker({ showLiveUnavailable: true });
    screen.getByLabelText(/Refresh settings/i).click();
    expect(screen.getByText(/Live updates unavailable/i)).toBeInTheDocument();
  });
});
