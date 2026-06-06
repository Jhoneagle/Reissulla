import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type {
  PlanPreferences,
  TransitMode,
  TripPreference,
  WalkingSpeed,
} from "@reissulla/shared";
import { TimePickerDialog } from "./TimePickerDialog";

export interface PlannerControlsValue {
  dateTime: number | undefined;
  arriveBy: boolean;
  modes: TransitMode[];
  preference: TripPreference;
  planPreferences: PlanPreferences;
}

interface PlannerControlsProps {
  value: PlannerControlsValue;
  onChange: (next: PlannerControlsValue) => void;
}

const MODE_OPTIONS: { mode: TransitMode; labelId: string }[] = [
  { mode: "BUS", labelId: "transit.plan.mode.bus" },
  { mode: "TRAM", labelId: "transit.plan.mode.tram" },
  { mode: "RAIL", labelId: "transit.plan.mode.rail" },
  { mode: "SUBWAY", labelId: "transit.plan.mode.subway" },
  { mode: "FERRY", labelId: "transit.plan.mode.ferry" },
  { mode: "BICYCLE", labelId: "transit.plan.mode.bicycle" },
];

const PREFERENCE_OPTIONS: { value: TripPreference; labelId: string }[] = [
  { value: "fastest", labelId: "transit.plan.preference.fastest" },
  {
    value: "fewest-transfers",
    labelId: "transit.plan.preference.fewestTransfers",
  },
  {
    value: "least-walking",
    labelId: "transit.plan.preference.leastWalking",
  },
];

const WALKING_SPEED_OPTIONS: { value: WalkingSpeed; labelId: string }[] = [
  { value: "slow", labelId: "transit.plan.walking.slow" },
  { value: "normal", labelId: "transit.plan.walking.normal" },
  { value: "fast", labelId: "transit.plan.walking.fast" },
];

function formatTimeLabel(unix: number | undefined, locale: string): string {
  if (!unix) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Helsinki",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unix * 1000));
}

export function PlannerControls({ value, onChange }: PlannerControlsProps) {
  const intl = useIntl();
  const [pickerOpen, setPickerOpen] = useState(false);

  function toggleMode(mode: TransitMode) {
    const next = value.modes.includes(mode)
      ? value.modes.filter((m) => m !== mode)
      : [...value.modes, mode];
    onChange({ ...value, modes: next });
  }

  function patchPrefs(patch: Partial<PlanPreferences>) {
    onChange({
      ...value,
      planPreferences: { ...value.planPreferences, ...patch },
    });
  }

  const timeLabel = value.dateTime
    ? formatTimeLabel(value.dateTime, intl.locale)
    : intl.formatMessage({ id: "transit.depart.time.now" });

  return (
    <div className="planner-controls">
      <div className="planner-controls__row planner-controls__row--time">
        <fieldset className="planner-controls__time-mode">
          <legend className="visually-hidden">
            <FormattedMessage id="transit.plan.time.legend" />
          </legend>
          <label className="planner-controls__radio">
            <input
              type="radio"
              name="planner-time-mode"
              checked={!value.arriveBy}
              onChange={() => onChange({ ...value, arriveBy: false })}
            />
            <FormattedMessage id="transit.plan.time.leaveAt" />
          </label>
          <label className="planner-controls__radio">
            <input
              type="radio"
              name="planner-time-mode"
              checked={value.arriveBy}
              onChange={() => onChange({ ...value, arriveBy: true })}
            />
            <FormattedMessage id="transit.plan.time.arriveBy" />
          </label>
        </fieldset>
        <button
          type="button"
          className="btn btn--secondary btn--sm planner-controls__time-button"
          onClick={() => setPickerOpen(true)}
          aria-label={intl.formatMessage(
            { id: "transit.plan.time.openPicker" },
            { time: timeLabel },
          )}
        >
          {timeLabel}
        </button>
      </div>

      <div className="planner-controls__row">
        <span className="planner-controls__row-label">
          <FormattedMessage id="transit.plan.modes.label" />
        </span>
        <div className="planner-controls__chips">
          {MODE_OPTIONS.map((opt) => {
            const active = value.modes.includes(opt.mode);
            return (
              <button
                key={opt.mode}
                type="button"
                className={`planner-controls__chip${active ? " planner-controls__chip--active" : ""}`}
                aria-pressed={active}
                onClick={() => toggleMode(opt.mode)}
              >
                <FormattedMessage id={opt.labelId} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="planner-controls__row">
        <label className="planner-controls__row-label" htmlFor="planner-pref">
          <FormattedMessage id="transit.plan.preference.label" />
        </label>
        <select
          id="planner-pref"
          className="planner-controls__select"
          value={value.preference}
          onChange={(e) =>
            onChange({
              ...value,
              preference: e.target.value as TripPreference,
            })
          }
        >
          {PREFERENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {intl.formatMessage({ id: opt.labelId })}
            </option>
          ))}
        </select>
      </div>

      <details className="planner-controls__advanced">
        <summary>
          <FormattedMessage id="transit.plan.advanced.summary" />
        </summary>
        <div className="planner-controls__advanced-grid">
          <div className="planner-controls__row planner-controls__row--inline">
            <label
              className="planner-controls__row-label"
              htmlFor="planner-walking-speed"
            >
              <FormattedMessage id="transit.plan.walking.speed" />
            </label>
            <select
              id="planner-walking-speed"
              className="planner-controls__select"
              value={value.planPreferences.walkingSpeed}
              onChange={(e) =>
                patchPrefs({
                  walkingSpeed: e.target.value as WalkingSpeed,
                })
              }
            >
              {WALKING_SPEED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {intl.formatMessage({ id: opt.labelId })}
                </option>
              ))}
            </select>
          </div>

          <div className="planner-controls__row planner-controls__row--inline">
            <label
              className="planner-controls__row-label"
              htmlFor="planner-max-walk"
            >
              <FormattedMessage
                id="transit.plan.walking.maxDistance"
                values={{
                  distance: intl.formatNumber(
                    value.planPreferences.maxWalkDistanceMeters,
                  ),
                }}
              />
            </label>
            <input
              id="planner-max-walk"
              type="range"
              min={200}
              max={4000}
              step={100}
              value={value.planPreferences.maxWalkDistanceMeters}
              onChange={(e) =>
                patchPrefs({ maxWalkDistanceMeters: Number(e.target.value) })
              }
            />
          </div>

          <div className="planner-controls__row planner-controls__row--inline">
            <label className="planner-controls__checkbox">
              <input
                type="checkbox"
                checked={value.planPreferences.avoidTransfers}
                onChange={(e) =>
                  patchPrefs({ avoidTransfers: e.target.checked })
                }
              />
              <FormattedMessage id="transit.plan.avoidTransfers" />
            </label>
            <label className="planner-controls__checkbox">
              <input
                type="checkbox"
                checked={value.planPreferences.avoidStairs}
                onChange={(e) => patchPrefs({ avoidStairs: e.target.checked })}
              />
              <FormattedMessage id="transit.plan.avoidStairs" />
            </label>
          </div>
        </div>
      </details>

      <TimePickerDialog
        value={value.dateTime}
        onChange={(next) => onChange({ ...value, dateTime: next })}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
