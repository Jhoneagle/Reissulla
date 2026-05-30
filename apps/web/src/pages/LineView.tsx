import { useEffect } from "react";
import { FormattedMessage } from "react-intl";
import { Link, useParams, useSearchParams } from "react-router";
import type { DayType, DirectionId } from "@reissulla/shared";
import { LineCard } from "../components/transit/LineCard";
import "./LineView.css";

export function LineView() {
  const { gtfsId: rawGtfsId } = useParams<{ gtfsId: string }>();
  const gtfsId = rawGtfsId ? decodeURIComponent(rawGtfsId) : null;

  const [searchParams, setSearchParams] = useSearchParams();
  const direction = parseDirection(searchParams.get("dir")) ?? 0;
  const dayType = parseDayType(searchParams.get("dayType")) ?? "weekday";

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
  return (
    <nav className="line-view__back">
      <Link to="/transit?tab=lines">
        <FormattedMessage id="transit.line.back" />
      </Link>
    </nav>
  );
}
