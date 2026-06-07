import { FormattedMessage, useIntl } from "react-intl";
import type { ChangeEvent } from "react";
import type { RefreshChoice } from "../../hooks/useRefreshChoice";

interface RefreshTickerProps {
  choice: RefreshChoice;
  onChoiceChange: (next: RefreshChoice) => void;
  /**
   * SSE was attempted but isn't currently delivering — surfaces the inline
   * "Live updates unavailable here — falling back to 30 s" notice when the
   * user has the `live` option selected.
   */
  showLiveUnavailable: boolean;
}

const CHOICES: ReadonlyArray<RefreshChoice> = ["live", "30s", "60s", "off"];

/**
 * DEP-14 refresh-cadence control. Cog button opens a native `<details>`
 * disclosure (per §15.2 of the Phase 4 plan — Modal would be overkill for
 * four radio choices) and the user picks Live / 30 s / 60 s / off. The
 * choice persists per-device via `useRefreshChoice` (localStorage); the
 * parent provides current value + setter so the hook only mounts once.
 *
 * The cog itself is a `.btn .btn--ghost` icon button with a 44×44 hit
 * target (transparent padding around the visible cog) for WCAG 2.5.8.
 */
export function RefreshTicker({
  choice,
  onChoiceChange,
  showLiveUnavailable,
}: RefreshTickerProps) {
  const intl = useIntl();

  const onChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChoiceChange(e.target.value as RefreshChoice);
  };

  return (
    <details className="refresh-ticker">
      <summary
        className="btn btn--ghost refresh-ticker__cog"
        aria-label={intl.formatMessage({
          id: "transit.live.refresh.openLabel",
        })}
      >
        <svg
          className="refresh-ticker__cog-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </summary>
      <div className="refresh-ticker__panel" role="group">
        <p className="refresh-ticker__title">
          <FormattedMessage id="transit.live.refresh.title" />
        </p>
        <fieldset className="refresh-ticker__radio-group">
          <legend className="visually-hidden">
            <FormattedMessage id="transit.live.refresh.legend" />
          </legend>
          {CHOICES.map((option) => (
            <label key={option} className="refresh-ticker__option">
              <input
                type="radio"
                name="refresh-choice"
                value={option}
                checked={choice === option}
                onChange={onChange}
              />
              <span>
                <FormattedMessage
                  id={`transit.live.refresh.option.${option}`}
                />
              </span>
            </label>
          ))}
        </fieldset>
        {showLiveUnavailable && (
          <p className="refresh-ticker__notice">
            <FormattedMessage id="transit.live.refresh.unavailable" />
          </p>
        )}
      </div>
    </details>
  );
}
