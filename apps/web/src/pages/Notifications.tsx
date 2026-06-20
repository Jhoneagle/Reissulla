import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Alert,
  AlertSeverity,
  AlertSource,
  NotifiedAlert,
} from "@reissulla/shared";
import type { NotificationsResponse } from "@reissulla/api-client";
import { useAuthStore } from "../stores/auth";
import { usePreferences } from "../hooks/usePreferences";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from "../hooks/useNotifications";
import { showToast } from "../stores/toast";
import { SatelliteArt } from "../components/art/EmptyArt";
import "../components/Notifications.css";

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  info: "ⓘ",
  warning: "!",
  severe: "✕",
};

// Source → page group. Transit first (most actionable), then weather, then
// roads — mirrors the dashboard banner's ordering.
const SOURCE_ORDER: AlertSource[] = ["digitransit", "fmi", "fintraffic"];
const SOURCE_LABEL_ID: Record<AlertSource, string> = {
  digitransit: "notifications.group.transit",
  fmi: "notifications.group.weather",
  fintraffic: "notifications.group.roads",
};

const NOTIFICATIONS_KEY = ["notifications"] as const;

export function Notifications() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const prefs = usePreferences().data;
  const query = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const qc = useQueryClient();

  if (!user) {
    return (
      <section aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">
          <FormattedMessage id="notifications.heading" />
        </h2>
        <aside className="cta-card" aria-labelledby="notifications-cta-heading">
          <h3 id="notifications-cta-heading" className="cta-card__heading">
            <FormattedMessage id="notifications.anonymous.heading" />
          </h3>
          <p className="cta-card__description">
            <FormattedMessage id="notifications.anonymous.description" />
          </p>
          <div className="cta-card__actions">
            <Link to="/login" className="btn btn--primary">
              <FormattedMessage id="settings.anonymous.cta.signIn" />
            </Link>
          </div>
        </aside>
      </section>
    );
  }

  const notified = query.data?.data ?? [];
  const unreadCount = notified.filter((n) => n.unread).length;

  function handleMarkAll() {
    if (unreadCount === 0) return;
    const prev = qc.getQueryData<NotificationsResponse>(NOTIFICATIONS_KEY);
    // Optimistic: clear unread immediately so the page + bell feel instant.
    qc.setQueryData<NotificationsResponse>(NOTIFICATIONS_KEY, (old) =>
      old
        ? {
            data: old.data.map((n) => ({ ...n, unread: false })),
            unreadCount: 0,
          }
        : old,
    );
    // 5 s undo window before the server commit lands (avoids the "I lost my
    // place" panic of an irreversible mark-all).
    showToast({
      message: intl.formatMessage(
        { id: "notifications.markAll.toast" },
        { count: unreadCount },
      ),
      kind: "success",
      durationMs: 5000,
      action: {
        label: intl.formatMessage({ id: "undoableDelete.undo" }),
        onClick: () => {
          if (prev) qc.setQueryData(NOTIFICATIONS_KEY, prev);
        },
      },
      onTimeout: () => markAllRead.mutate(),
    });
  }

  return (
    <section aria-labelledby="notifications-heading" className="notifications">
      <div className="notifications__masthead">
        <h2 id="notifications-heading">
          <FormattedMessage id="notifications.heading" />
        </h2>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleMarkAll}
          >
            <FormattedMessage id="notifications.markAll.button" />
          </button>
        )}
      </div>

      <p className="notifications__intro">
        <FormattedMessage id="notifications.intro" />
      </p>

      {query.isLoading && (
        <p role="status">
          <FormattedMessage id="notifications.loading" />
        </p>
      )}

      {!query.isLoading && notified.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__art" aria-hidden="true">
            <SatelliteArt />
          </div>
          <p className="empty-state__phrase">
            <FormattedMessage id="notifications.empty" />
          </p>
          <p>
            <Link to="/transit">
              <FormattedMessage id="notifications.empty.ctaTransit" />
            </Link>
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            <span aria-hidden="true"> · </span>
            <Link to="/map">
              <FormattedMessage id="notifications.empty.ctaMap" />
            </Link>
          </p>
        </div>
      )}

      {SOURCE_ORDER.map((source) => {
        const items = notified.filter((n) => n.alert.source === source);
        if (items.length === 0) return null;
        return (
          <section key={source} aria-labelledby={`notif-group-${source}`}>
            <h3 id={`notif-group-${source}`} className="notifications__group">
              <FormattedMessage id={SOURCE_LABEL_ID[source]} />
            </h3>
            <ul className="notifications__list">
              {items.map((item) => (
                <NotificationRow
                  key={item.alert.id}
                  item={item}
                  openByDefault={prefs?.srOptimised ?? false}
                  onMarkRead={() => markRead.mutate([item.alert.id])}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

function NotificationRow({
  item,
  openByDefault,
  onMarkRead,
}: {
  item: NotifiedAlert;
  openByDefault: boolean;
  onMarkRead: () => void;
}) {
  const intl = useIntl();
  const { alert, unread } = item;
  const locale = intl.locale === "en" ? "en" : "fi";
  const headline = alert.headline[locale].trim() || alert.description[locale];
  const body = alert.description[locale].trim();
  const severityLabel = intl.formatMessage({
    id: `alert.severity.${alert.severity}`,
  });

  return (
    <li
      className={`notification-item notification-item--${alert.severity}${unread ? " notification-item--unread" : ""}`}
    >
      <div className="notification-item__head">
        <span
          className={`notification-item__badge alert-banner--${alert.severity}`}
        >
          <span aria-hidden="true">{SEVERITY_ICON[alert.severity]}</span>
          {severityLabel}
        </span>
        {unread && (
          <span className="notification-item__unread-dot" aria-hidden="true" />
        )}
        <span className="notification-item__time">
          {formatRange(alert, intl)}
        </span>
      </div>

      <details open={openByDefault} className="notification-item__details">
        <summary>{headline}</summary>
        {body.length > 0 && body !== headline && (
          <p className="notification-item__body">{body}</p>
        )}
        <p className="notification-item__scope">{scopeLabel(alert, intl)}</p>
      </details>

      {unread && (
        <button
          type="button"
          className="btn btn--ghost btn--sm notification-item__mark"
          onClick={onMarkRead}
        >
          <FormattedMessage id="notifications.markRead" />
        </button>
      )}
    </li>
  );
}

// 24-hour, Helsinki time — matches the departure-board / timetable convention
// used everywhere else in the app (not the locale-default 12-hour clock).
const ALERT_TIME_OPTS = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Helsinki",
} as const;

function formatRange(alert: Alert, intl: ReturnType<typeof useIntl>): string {
  const start = intl.formatTime(alert.startTime, ALERT_TIME_OPTS);
  if (alert.endTime === null) {
    return intl.formatMessage({ id: "notifications.time.from" }, { start });
  }
  const end = intl.formatTime(alert.endTime, ALERT_TIME_OPTS);
  return intl.formatMessage({ id: "notifications.time.range" }, { start, end });
}

function scopeLabel(alert: Alert, intl: ReturnType<typeof useIntl>): string {
  switch (alert.scope.kind) {
    case "route":
      return intl.formatMessage(
        { id: "notifications.scope.route" },
        { id: alert.scope.gtfsId },
      );
    case "stop":
      return intl.formatMessage(
        { id: "notifications.scope.stop" },
        { id: alert.scope.gtfsId },
      );
    case "region":
      return intl.formatMessage(
        { id: "notifications.scope.region" },
        { code: alert.scope.code },
      );
    case "global":
      return intl.formatMessage({ id: "notifications.scope.global" });
  }
}
