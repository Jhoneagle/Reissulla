import { useCallback } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useSearchParams } from "react-router";
import { DepartureBoard } from "../components/transit/DepartureBoard";
import { LineSearch } from "../components/transit/LineSearch";
import { RoutePlanner } from "../components/transit/RoutePlanner";
import "./Transit.css";

type TransitTab = "departures" | "lines" | "planner";

const TABS: { value: TransitTab; labelId: string }[] = [
  { value: "departures", labelId: "transit.tab.departures" },
  { value: "lines", labelId: "transit.tab.lines" },
  { value: "planner", labelId: "transit.tab.routePlanner" },
];

function parseTab(raw: string | null): TransitTab {
  if (raw === "lines" || raw === "planner") return raw;
  return "departures";
}

export function Transit() {
  const intl = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const linesQuery = searchParams.get("q") ?? "";
  const linesRegion = searchParams.get("region") ?? "";

  const setTab = useCallback(
    (next: TransitTab) => {
      const params = new URLSearchParams(searchParams);
      if (next === "departures") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  // Lines-tab search state lives in the URL so the back-link from a
  // line page can restore q + region, and so the search is bookmarkable
  // and shareable. Writes are replace-mode to avoid flooding history on
  // every committed debounce.
  const onLinesQueryCommit = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (next.length > 0) params.set("q", next);
      else params.delete("q");
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const onLinesRegionChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (next && next !== "all") params.set("region", next);
      else params.delete("region");
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="transit-page">
      <h2 className="visually-hidden" id="transit-heading">
        <FormattedMessage id="transit.heading" />
      </h2>

      <div
        role="tablist"
        aria-label={intl.formatMessage({ id: "transit.sections.label" })}
        className="transit-tabs"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            id={`tab-${t.value}`}
            role="tab"
            aria-selected={tab === t.value}
            aria-controls={`panel-${t.value}`}
            onClick={() => setTab(t.value)}
          >
            <TabIcon kind={t.value} />
            <FormattedMessage id={t.labelId} />
          </button>
        ))}
      </div>

      <div
        id="panel-departures"
        role="tabpanel"
        aria-labelledby="tab-departures"
        hidden={tab !== "departures"}
      >
        <DepartureBoard />
      </div>

      <div
        id="panel-lines"
        role="tabpanel"
        aria-labelledby="tab-lines"
        hidden={tab !== "lines"}
      >
        <LineSearch
          query={linesQuery}
          region={linesRegion}
          onQueryCommit={onLinesQueryCommit}
          onRegionChange={onLinesRegionChange}
        />
      </div>

      <div
        id="panel-planner"
        role="tabpanel"
        aria-labelledby="tab-planner"
        hidden={tab !== "planner"}
      >
        <RoutePlanner />
      </div>
    </div>
  );
}

function TabIcon({ kind }: { kind: TransitTab }) {
  if (kind === "lines") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    );
  }
  if (kind === "planner") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
