import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { DepartureBoard } from "../components/transit/DepartureBoard";
import { RoutePlanner } from "../components/transit/RoutePlanner";
import "./Transit.css";

type TransitTab = "departures" | "planner";

export function Transit() {
  const intl = useIntl();
  const [tab, setTab] = useState<TransitTab>("departures");

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
        <button
          id="tab-departures"
          role="tab"
          aria-selected={tab === "departures"}
          aria-controls="panel-departures"
          onClick={() => setTab("departures")}
        >
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
          <FormattedMessage id="transit.tab.departures" />
        </button>
        <button
          id="tab-planner"
          role="tab"
          aria-selected={tab === "planner"}
          aria-controls="panel-planner"
          onClick={() => setTab("planner")}
        >
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
          <FormattedMessage id="transit.tab.routePlanner" />
        </button>
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
