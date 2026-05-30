import { useEffect, useRef } from "react";
import { FormattedMessage } from "react-intl";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import type { DayType, DirectionId } from "@reissulla/shared";
import { LineCard } from "../components/transit/LineCard";
import { dayTypeForToday } from "../lib/transit-utils";
import "./LineView.css";

export function LineView() {
  const { gtfsId: rawGtfsId } = useParams<{ gtfsId: string }>();
  const gtfsId = rawGtfsId ? decodeURIComponent(rawGtfsId) : null;

  const [searchParams, setSearchParams] = useSearchParams();
  const direction = parseDirection(searchParams.get("dir")) ?? 0;
  const dayType =
    parseDayType(searchParams.get("dayType")) ?? dayTypeForToday();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [gtfsId]);

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
    </section>
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
  // moment the user adjusts the view.
  const fromRef = useRef<string | null>(null);
  if (fromRef.current === null) {
    const raw = (location.state as { from?: unknown } | null)?.from;
    fromRef.current = typeof raw === "string" && raw.length > 0 ? raw : "";
  }
  const to = fromRef.current || "/transit?tab=lines";
  return (
    <nav className="line-view__back">
      <Link to={to}>
        <FormattedMessage id="transit.line.back" />
      </Link>
    </nav>
  );
}
