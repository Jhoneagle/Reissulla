import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import type { DayType, DirectionId } from "@reissulla/shared";
import { LineCard } from "../components/transit/LineCard";
import { LiveVehiclesPanel } from "../components/transit/LiveVehiclesPanel";
import { AlertBanner } from "../components/alerts/AlertBanner";
import { useLiveAlerts } from "../hooks/useAlerts";
import { dayTypeForToday } from "../lib/transit-utils";
import "./LineView.css";

export function LineView() {
  const { gtfsId: rawGtfsId } = useParams<{ gtfsId: string }>();
  const gtfsId = rawGtfsId ? decodeURIComponent(rawGtfsId) : null;

  const [searchParams, setSearchParams] = useSearchParams();
  const direction = parseDirection(searchParams.get("dir")) ?? 0;
  const dayType =
    parseDayType(searchParams.get("dayType")) ?? dayTypeForToday();

  const location = useLocation();
  useEffect(() => {
    // A "#live" deep-link (from the dashboard "View live" action) scrolls to
    // the vehicle panel; otherwise land at the top of the line.
    if (location.hash === "#live") {
      document.getElementById("live")?.scrollIntoView({ behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [gtfsId, location.hash]);

  if (!gtfsId) {
    return (
      <section className="line-view">
        <BackLink />
        <div className="line-view__error-block">
          <p>
            <FormattedMessage id="transit.line.notFound" />
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="line-view">
      <BackLink />
      <LineAlerts gtfsId={gtfsId} />
      <LineCard
        gtfsId={gtfsId}
        direction={direction}
        onDirectionChange={(next) =>
          setSearchParams(setParam(searchParams, "dir", String(next)))
        }
        dayType={dayType}
        onDayTypeChange={(next) =>
          setSearchParams(setParam(searchParams, "dayType", next))
        }
        showFineprint
      />
      <div id="live">
        <LiveVehiclesPanel gtfsId={gtfsId} direction={direction} />
      </div>
    </section>
  );
}

/** Leading service-alert banner for the line. Renders nothing when clear. */
function LineAlerts({ gtfsId }: { gtfsId: string }) {
  const { alerts } = useLiveAlerts({ routes: [gtfsId] });
  return (
    <AlertBanner
      kind="transit"
      alerts={alerts}
      restoreFocusToId="main-content"
    />
  );
}

function parseDirection(raw: string | null): DirectionId | undefined {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return undefined;
}

function parseDayType(raw: string | null): DayType | undefined {
  if (raw === "weekday" || raw === "saturday" || raw === "sunday") return raw;
  return undefined;
}

function setParam(
  current: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set(key, value);
  return next;
}

function BackLink() {
  const location = useLocation();
  // Snapshot the originating URL once. In-page setSearchParams() calls
  // (direction toggle, day-type tab) overwrite location.state with null,
  // so reading it on every render would lose the search context the
  // moment the user adjusts the view. useState's lazy initializer
  // captures the value on first render and never updates.
  const [from] = useState(() => {
    const raw = (location.state as { from?: unknown } | null)?.from;
    return typeof raw === "string" && raw.length > 0 ? raw : "";
  });
  const to = from || "/transit?tab=lines";
  return (
    <nav className="line-view__back">
      <Link to={to}>
        <FormattedMessage id="transit.line.back" />
      </Link>
    </nav>
  );
}
