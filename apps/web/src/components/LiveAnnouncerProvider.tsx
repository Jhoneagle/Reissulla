import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useIntl, type IntlShape } from "react-intl";
import type { ReadingPace, Verbosity } from "@reissulla/shared";
import { usePreferences } from "../hooks/usePreferences";
import {
  createLiveAnnouncer,
  type ApproachPayload,
  type LiveAnnouncer,
} from "../lib/live-region";

/**
 * DEP-13 announcer mount. Owns the page-root polite live region (separate from
 * the toast region and the form-error region, so an approach announcement and
 * a toast can coexist without preempting each other) and wires the pure
 * timing core to intl-formatted output.
 *
 * Verbosity (A11Y-29) and reading pace (A11Y-23) come from
 * `preferences.extra.liveRegion`; reading pace maps to the coalesce window —
 * a slower reader gets a wider window so more announcements merge into one.
 */

const PACE_TO_COALESCE_MS: Record<ReadingPace, number> = {
  slow: 4000,
  normal: 2000,
  fast: 1000,
};

const LiveAnnouncerContext = createContext<LiveAnnouncer | null>(null);

const NOOP_ANNOUNCER: LiveAnnouncer = {
  announce: () => {},
  dispose: () => {},
};

/**
 * Access the announcer. Returns a no-op when no provider is mounted (e.g. in
 * component tests that render a board in isolation), so callers never need a
 * null check.
 */
export function useLiveAnnouncer(): LiveAnnouncer {
  return useContext(LiveAnnouncerContext) ?? NOOP_ANNOUNCER;
}

function etaPhrase(etaSeconds: number, intl: IntlShape): string {
  if (etaSeconds < 60)
    return intl.formatMessage({ id: "liveAnnouncer.eta.now" });
  if (etaSeconds < 120) {
    return intl.formatMessage({ id: "liveAnnouncer.eta.aboutMinute" });
  }
  return intl.formatMessage(
    { id: "liveAnnouncer.eta.minutes" },
    { minutes: Math.round(etaSeconds / 60) },
  );
}

function formatBatch(
  batch: ApproachPayload[],
  verbosity: Verbosity,
  intl: IntlShape,
): string {
  if (batch.length === 0) return "";
  const stop = batch[0]!.stopName;

  // Multiple lines coalesced for one stop → one combined message.
  if (batch.length > 1) {
    const routes = intl.formatList(
      batch.map((p) => p.routeShortName),
      { type: "conjunction" },
    );
    return intl.formatMessage(
      { id: "liveAnnouncer.combined" },
      { routes, stop },
    );
  }

  const p = batch[0]!;
  switch (verbosity) {
    case "terse":
      return intl.formatMessage(
        { id: "liveAnnouncer.terse" },
        { route: p.routeShortName },
      );
    case "standard":
      return intl.formatMessage(
        { id: "liveAnnouncer.standard" },
        { route: p.routeShortName, stop },
      );
    case "verbose":
      return intl.formatMessage(
        { id: "liveAnnouncer.verbose" },
        {
          route: p.routeShortName,
          headsign: p.headsign,
          stop,
          eta: etaPhrase(p.etaSeconds, intl),
        },
      );
  }
}

export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const intl = useIntl();
  const prefs = usePreferences().data;
  const verbosity = prefs?.extra.liveRegion?.verbosity ?? "standard";
  const readingPace = prefs?.extra.liveRegion?.readingPace ?? "normal";
  const coalesceMs = PACE_TO_COALESCE_MS[readingPace];

  // The announcer emits a coalesced batch; we keep the raw batch in state and
  // format it during render. That way locale / verbosity changes re-format the
  // current message without recreating the announcer (which would drop pending
  // timers) — and no ref is read during render.
  const [pending, setPending] = useState<ApproachPayload[] | null>(null);

  const announcer = useMemo(
    () =>
      createLiveAnnouncer({
        coalesceMs,
        emit: (batch) => setPending(batch),
      }),
    [coalesceMs],
  );

  useEffect(() => () => announcer.dispose(), [announcer]);

  const message = pending ? formatBatch(pending, verbosity, intl) : "";

  return (
    <LiveAnnouncerContext.Provider value={announcer}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="live-announcer visually-hidden"
      >
        {message}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}
