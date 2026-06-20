import { Link } from "react-router";
import { useIntl } from "react-intl";
import { useAuthStore } from "../stores/auth";
import { useUnreadCount } from "../hooks/useNotifications";
import "./Notifications.css";

/**
 * Top-nav bell linking to the notification centre. Signed-in only — anonymous
 * users have no per-user inbox. Renders even at zero unread (discoverability
 * over hiding); the badge appears only when count > 0.
 *
 * The accessible name carries the count, so the badge itself is decorative
 * (`aria-hidden`). The unread count does NOT announce on change — the
 * dashboard banner + its toast carry that news; a badge tick mid-task on
 * another page shouldn't interrupt.
 */
export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const intl = useIntl();
  const { data: count = 0 } = useUnreadCount();

  if (!user) return null;

  const label =
    count > 0
      ? intl.formatMessage({ id: "notifications.bell.unread" }, { count })
      : intl.formatMessage({ id: "notifications.bell.none" });
  const badgeText = count > 99 ? "99+" : String(count);

  return (
    <Link
      to="/notifications"
      className="notification-bell btn btn--ghost btn--sm"
      aria-label={label}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="notification-bell__badge" aria-hidden="true">
          {badgeText}
        </span>
      )}
    </Link>
  );
}
