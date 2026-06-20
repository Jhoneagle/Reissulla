import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { PinSuggestion } from "@reissulla/shared";
import { useAuthStore } from "../../stores/auth";
import { useSuggestedPins } from "../../hooks/useHistory";
import { usePinLine, usePinStop } from "../../hooks/useTransit";
import "./suggest-pin-card.css";

type Suggestion = PinSuggestion & { kind: "stop" | "line" };

const DISMISS_KEY = "reissulla:suggest-pin:dismissed";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(set: Set<string>): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage unavailable (private mode quota) — degrade to in-memory.
  }
}

/**
 * HIST-2 — surfaces frequently-used stops / lines the user hasn't pinned yet.
 * Suggestions are derived statelessly server-side; the card caps to the 3
 * highest-use entries. "Pin" calls the existing pin endpoints; "Dismiss"
 * hides the row for the rest of the session via sessionStorage (a fresh
 * session re-surfaces it — no persistent dismissal store until users ask).
 */
export function SuggestPinCard() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data } = useSuggestedPins(Boolean(user));
  const pinStop = usePinStop();
  const pinLine = usePinLine();
  // Hidden = dismissed (persisted) + just-pinned (session-local). Seeded from
  // the persisted dismissals so a reload keeps dismissed rows hidden.
  const [hidden, setHidden] = useState<Set<string>>(() => readDismissed());

  if (!user) return null;

  const lines: Suggestion[] = (data?.data.lines ?? []).map((l) => ({
    ...l,
    kind: "line",
  }));
  const stops: Suggestion[] = (data?.data.stops ?? []).map((s) => ({
    ...s,
    kind: "stop",
  }));
  const suggestions = [...lines, ...stops]
    .filter((s) => !hidden.has(s.gtfsId))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 3);

  if (suggestions.length === 0) return null;

  function hide(gtfsId: string, persist: boolean) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(gtfsId);
      if (persist) persistDismissed(next);
      return next;
    });
  }

  function pin(s: Suggestion) {
    if (s.kind === "line") {
      pinLine.mutate({
        gtfsId: s.gtfsId,
        name: s.name,
        vehicleMode: s.vehicleMode ?? "BUS",
      });
    } else {
      pinStop.mutate({
        gtfsId: s.gtfsId,
        name: s.name,
        vehicleMode: s.vehicleMode,
        isStation: false,
      });
    }
    hide(s.gtfsId, false);
  }

  return (
    <section
      className="suggest-pin-card"
      aria-label={intl.formatMessage({ id: "history.suggest.title" })}
    >
      <p className="suggest-pin-card__kicker">
        <FormattedMessage id="history.suggest.kicker" />
      </p>
      <h3 className="suggest-pin-card__title">
        <FormattedMessage id="history.suggest.title" />
      </h3>
      <ul className="suggest-pin-card__list">
        {suggestions.map((s) => (
          <li key={`${s.kind}-${s.gtfsId}`} className="suggest-pin-card__item">
            <div className="suggest-pin-card__info">
              <span className="suggest-pin-card__name">
                {s.kind === "line" ? (
                  <FormattedMessage
                    id="history.suggest.lineLabel"
                    values={{
                      mode: modeLabel(intl, s.vehicleMode),
                      name: s.name,
                    }}
                  />
                ) : (
                  s.name
                )}
              </span>
              <span className="suggest-pin-card__uses">
                <FormattedMessage
                  id="history.suggest.uses"
                  values={{ uses: s.uses, days: s.windowDays }}
                />
              </span>
            </div>
            <div className="suggest-pin-card__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => pin(s)}
              >
                <FormattedMessage id="history.suggest.pin" />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => hide(s.gtfsId, true)}
              >
                <FormattedMessage id="history.suggest.dismiss" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function modeLabel(
  intl: ReturnType<typeof useIntl>,
  vehicleMode: string | null,
): string {
  if (!vehicleMode) return "";
  const id = `transit.mode.${vehicleMode.toLowerCase()}`;
  const label = intl.formatMessage({ id, defaultMessage: vehicleMode });
  return label;
}
