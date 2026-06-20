import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import { ApiError } from "@reissulla/api-client";
import type { TransitItinerary, TripLogEntry } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";
import { useHistory, useClearHistory } from "../hooks/useHistory";
import { usePreferences, useUpdatePreferences } from "../hooks/usePreferences";
import { ItineraryCard } from "../components/transit/ItineraryCard";
import { ItineraryDrawer } from "../components/transit/ItineraryDrawer";
import { SatelliteArt } from "../components/art/EmptyArt";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { showToast } from "../stores/toast";
import "../components/transit/history.css";

export function History() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const preferencesQuery = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const historyQuery = useHistory(Boolean(user));
  const clearHistory = useClearHistory();
  const { confirm, dialogProps } = useConfirm();
  const [selected, setSelected] = useState<TransitItinerary | null>(null);

  // Anonymous: mirror the /settings behaviour — direct navigation shows a
  // sign-in CTA rather than an empty page (the nav link itself is hidden).
  if (!user) {
    return (
      <section aria-labelledby="history-heading">
        <h2 id="history-heading">
          <FormattedMessage id="history.heading" />
        </h2>
        <aside className="cta-card" aria-labelledby="history-cta-heading">
          <h3 id="history-cta-heading" className="cta-card__heading">
            <FormattedMessage id="history.anonymous.heading" />
          </h3>
          <p className="cta-card__description">
            <FormattedMessage id="history.anonymous.description" />
          </p>
          <div className="cta-card__actions">
            <Link to="/login" className="btn btn--primary">
              <FormattedMessage id="history.anonymous.signIn" />
            </Link>
          </div>
        </aside>
      </section>
    );
  }

  const tripLogEnabled = preferencesQuery.data?.tripLogEnabled ?? false;
  const trips = historyQuery.data?.data ?? [];

  async function enableTripLog() {
    try {
      await updatePreferences.mutateAsync({ tripLogEnabled: true });
      showToast({
        message: intl.formatMessage({ id: "settings.savedToast" }),
        kind: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" });
      showToast({ message, kind: "error" });
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: intl.formatMessage({ id: "history.clearConfirm" }),
      destructive: true,
    });
    if (!ok) return;
    try {
      await clearHistory.mutateAsync();
      showToast({
        message: intl.formatMessage({ id: "history.clearedToast" }),
        kind: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" });
      showToast({ message, kind: "error" });
    }
  }

  return (
    <section aria-labelledby="history-heading" className="history-page">
      <h2 id="history-heading">
        <FormattedMessage id="history.heading" />
      </h2>
      <p className="help">
        <FormattedMessage id="history.intro" />
      </p>

      {trips.length === 0 ? (
        tripLogEnabled ? (
          <EmptyEnabled />
        ) : (
          <OptInCta onEnable={() => void enableTripLog()} />
        )
      ) : (
        <>
          <ul className="history-list">
            {trips.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onOpen={() => setSelected(entry.itinerary)}
              />
            ))}
          </ul>
          <div className="history-page__actions">
            <button
              type="button"
              className="btn btn--destructive btn--sm"
              onClick={() => void handleClear()}
              disabled={clearHistory.isPending}
            >
              <FormattedMessage id="history.clearAll" />
            </button>
          </div>
        </>
      )}

      <ItineraryDrawer itinerary={selected} onClose={() => setSelected(null)} />
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}

function HistoryRow({
  entry,
  onOpen,
}: {
  entry: TripLogEntry;
  onOpen: () => void;
}) {
  const intl = useIntl();
  const planned = intl.formatDate(entry.plannedAt, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <li className="history-list__item">
      <button type="button" className="history-row" onClick={onOpen}>
        <span className="history-row__date">{planned}</span>
        <ItineraryCard itinerary={entry.itinerary} index={0} compact />
      </button>
    </li>
  );
}

function OptInCta({ onEnable }: { onEnable: () => void }) {
  return (
    <aside className="cta-card" aria-labelledby="history-optin-heading">
      <h3 id="history-optin-heading" className="cta-card__heading">
        <FormattedMessage id="history.optIn.heading" />
      </h3>
      <p className="cta-card__description">
        <FormattedMessage id="history.optIn.description" />
      </p>
      <div className="cta-card__actions">
        <button type="button" className="btn btn--primary" onClick={onEnable}>
          <FormattedMessage id="history.optIn.enable" />
        </button>
      </div>
    </aside>
  );
}

function EmptyEnabled() {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state__art empty-state__art--lg" aria-hidden="true">
        <SatelliteArt />
      </div>
      <p className="empty-state__phrase">
        <FormattedMessage id="history.empty" />
      </p>
      <p className="help">
        <FormattedMessage id="history.empty.hint" />
      </p>
    </div>
  );
}
