import { useState, type KeyboardEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { usePersonaStore } from "../../stores/persona";
import { useAuthStore } from "../../stores/auth";
import { useUpdatePreferences } from "../../hooks/usePreferences";

export interface AdvancedFilterState {
  lineFilter: string[];
  directionFilter: string;
  lowFloorOnly: boolean;
}

interface DepartureFiltersProps {
  value: AdvancedFilterState;
  onChange: (next: AdvancedFilterState) => void;
}

const EMPTY: AdvancedFilterState = {
  lineFilter: [],
  directionFilter: "",
  lowFloorOnly: false,
};

export function DepartureFilters({ value, onChange }: DepartureFiltersProps) {
  const intl = useIntl();
  const [draftLine, setDraftLine] = useState("");
  const persona = usePersonaStore((s) => s.persona);
  const setPersona = usePersonaStore((s) => s.set);
  const user = useAuthStore((s) => s.user);
  const updatePreferences = useUpdatePreferences();

  // Cross-link A11Y-19 — when the user enables the low-floor filter here
  // but their planner persona hasn't picked it up yet, surface a one-tap
  // affordance to mirror the choice into trip planning. Hidden as soon as
  // persona.lowFloor is on (or the filter itself is off).
  const showPlannerCrossLink = value.lowFloorOnly && !persona.lowFloor;

  function applyLowFloorToPlanner() {
    setPersona({ lowFloor: true });
    if (user) {
      updatePreferences.mutate({
        extra: { persona: { ...persona, lowFloor: true } },
      });
    }
  }

  function commitLine() {
    const code = draftLine.trim();
    if (!code) return;
    if (value.lineFilter.includes(code)) {
      setDraftLine("");
      return;
    }
    onChange({ ...value, lineFilter: [...value.lineFilter, code] });
    setDraftLine("");
  }

  function removeLine(code: string) {
    onChange({
      ...value,
      lineFilter: value.lineFilter.filter((c) => c !== code),
    });
  }

  function handleLineKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitLine();
    } else if (
      e.key === "Backspace" &&
      draftLine === "" &&
      value.lineFilter.length > 0
    ) {
      e.preventDefault();
      removeLine(value.lineFilter[value.lineFilter.length - 1]!);
    }
  }

  const hasAny =
    value.lineFilter.length > 0 ||
    value.directionFilter.trim().length > 0 ||
    value.lowFloorOnly;

  return (
    <details className="departure-filters">
      <summary className="departure-filters__summary">
        <span>
          <FormattedMessage id="transit.depart.filters.advanced" />
        </span>
        {hasAny && (
          <span className="departure-filters__count" aria-hidden="true">
            {value.lineFilter.length +
              (value.directionFilter.trim() ? 1 : 0) +
              (value.lowFloorOnly ? 1 : 0)}
          </span>
        )}
      </summary>

      <div className="departure-filters__panel">
        <div className="departure-filters__row">
          <label className="departure-filters__label" htmlFor="dep-line-input">
            <FormattedMessage id="transit.depart.filters.lineLabel" />
          </label>
          <div className="departure-filters__line-input">
            {value.lineFilter.length > 0 && (
              <ul
                className="departure-filters__chips"
                aria-label={intl.formatMessage({
                  id: "transit.depart.filters.activeLines",
                })}
              >
                {value.lineFilter.map((code) => (
                  <li key={code} className="departure-filters__chip">
                    <span>{code}</span>
                    <button
                      type="button"
                      className="departure-filters__chip-remove"
                      aria-label={intl.formatMessage(
                        { id: "transit.depart.filters.removeLine" },
                        { line: code },
                      )}
                      onClick={() => removeLine(code)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <input
              id="dep-line-input"
              type="text"
              inputMode="text"
              value={draftLine}
              onChange={(e) => setDraftLine(e.target.value)}
              onKeyDown={handleLineKey}
              onBlur={commitLine}
              placeholder={intl.formatMessage({
                id: "transit.depart.filters.linePlaceholder",
              })}
            />
          </div>
        </div>

        <div className="departure-filters__row">
          <label
            className="departure-filters__label"
            htmlFor="dep-direction-input"
          >
            <FormattedMessage id="transit.depart.filters.directionLabel" />
          </label>
          <input
            id="dep-direction-input"
            type="text"
            value={value.directionFilter}
            onChange={(e) =>
              onChange({ ...value, directionFilter: e.target.value })
            }
            placeholder={intl.formatMessage({
              id: "transit.depart.filters.directionPlaceholder",
            })}
          />
        </div>

        <div className="departure-filters__row departure-filters__row--inline">
          <label className="departure-filters__checkbox">
            <input
              type="checkbox"
              checked={value.lowFloorOnly}
              onChange={(e) =>
                onChange({ ...value, lowFloorOnly: e.target.checked })
              }
            />
            <span>
              <FormattedMessage id="transit.depart.filters.lowFloor" />
            </span>
          </label>
          {showPlannerCrossLink && (
            <button
              type="button"
              className="btn btn--link departure-filters__planner-link"
              onClick={applyLowFloorToPlanner}
            >
              <FormattedMessage id="transit.depart.filters.lowFloor.planLink" />
            </button>
          )}
        </div>

        {hasAny && (
          <div className="departure-filters__actions">
            <button
              type="button"
              className="btn btn--link"
              onClick={() => onChange(EMPTY)}
            >
              <FormattedMessage id="transit.depart.filters.clear" />
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
