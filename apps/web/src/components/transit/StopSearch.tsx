import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { TransitStop } from "@reissulla/shared";
import { useDebounce } from "../../hooks/useDebounce";
import { useStopSearch } from "../../hooks/useTransit";
import { vehicleModeLabel } from "../../lib/transit-utils";

interface StopSearchProps {
  id?: string;
  onSelect: (stop: TransitStop) => void;
}

type ModeFilter = "" | "BUS" | "TRAM" | "RAIL" | "SUBWAY" | "FERRY";
const MODE_CHIPS: ModeFilter[] = ["BUS", "TRAM", "RAIL", "SUBWAY", "FERRY"];

// Numeric or short-alphanumeric inputs that look like a transit line
// shortname — e.g. "550", "23A", "I3", "K". The shortcut affordance fires
// against byLine on these instead of stop-name search.
const LINE_CODE = /^[A-Z]?\d{1,3}[A-Z]?$|^[KIPNYAU]$/i;

function looksLikeLineCode(s: string): boolean {
  return LINE_CODE.test(s.trim());
}

export function StopSearch({ id = "stop-search", onSelect }: StopSearchProps) {
  const intl = useIntl();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mode, setMode] = useState<ModeFilter>("");
  const [region, setRegion] = useState<string>("");
  const [operator, setOperator] = useState<string>("");
  const [byLine, setByLine] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const listboxId = `${id}-listbox`;
  const filterId = `${id}-filters`;

  const { data, isLoading, isError } = useStopSearch(debouncedQuery, {
    mode: mode || undefined,
    region: region || undefined,
    operator: operator || undefined,
    byLine: byLine || undefined,
  });
  const results = useMemo(() => data?.data ?? [], [data]);

  // Regions + operators dropdowns are populated from the union of
  // currently-rendered results. Keeps the FE self-contained — no extra
  // Pelias call to enumerate localities, and the lists stay relevant to
  // what the search actually returned.
  const regionOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of results) {
      if (r.city) seen.add(r.city);
    }
    return Array.from(seen).sort();
  }, [results]);
  const operatorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of results) {
      for (const a of r.agencies ?? []) seen.set(a.gtfsId, a.name);
    }
    return Array.from(seen.entries())
      .map(([gtfsId, name]) => ({ gtfsId, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [results]);

  const prevResultsLength = useRef(0);
  useEffect(() => {
    if (
      results.length > 0 &&
      prevResultsLength.current === 0 &&
      (debouncedQuery.length >= 2 || byLine)
    ) {
      setOpen(true);
    }
    prevResultsLength.current = results.length;
  }, [results.length, debouncedQuery.length, byLine]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const selectResult = useCallback(
    (stop: TransitStop) => {
      setQuery(stop.name);
      setOpen(false);
      setActiveIndex(-1);
      onSelect(stop);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          const stop = results[activeIndex];
          if (stop) selectResult(stop);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setOpen(false), 200);
  };

  const showDropdown = open && (debouncedQuery.length >= 2 || Boolean(byLine));
  const activeDescendant =
    activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined;

  const lineCodeShortcutVisible =
    !byLine &&
    debouncedQuery.length > 0 &&
    looksLikeLineCode(debouncedQuery) &&
    results.length === 0 &&
    !isLoading;

  return (
    <div className="stop-search">
      <label htmlFor={id} className="visually-hidden">
        <FormattedMessage id="transit.stopSearch.inputLabel" />
      </label>
      <div className="stop-search__input-row">
        <svg
          className="stop-search__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          autoComplete="off"
          placeholder={intl.formatMessage({
            id: "transit.stopSearch.placeholder",
          })}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            if (e.target.value.trim().length < 2 && !byLine) setOpen(false);
          }}
          onFocus={() => {
            if (results.length > 0 && (debouncedQuery.length >= 2 || byLine)) {
              setOpen(true);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div
        id={filterId}
        className="stop-search__filters"
        role="group"
        aria-label={intl.formatMessage({
          id: "transit.stopSearch.filtersLabel",
        })}
      >
        <div className="stop-search__mode-chips" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={mode === ""}
            className={`stop-search__chip${
              mode === "" ? " stop-search__chip--on" : ""
            }`}
            onClick={() => setMode("")}
          >
            <FormattedMessage id="transit.stopSearch.mode.all" />
          </button>
          {MODE_CHIPS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`stop-search__chip${
                mode === m ? " stop-search__chip--on" : ""
              }`}
              onClick={() => setMode(mode === m ? "" : m)}
            >
              {vehicleModeLabel(m)}
            </button>
          ))}
        </div>
        <div className="stop-search__select-row">
          <label className="stop-search__select-label">
            <FormattedMessage id="transit.stopSearch.region.label" />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={regionOptions.length === 0}
            >
              <option value="">
                {intl.formatMessage({ id: "transit.stopSearch.region.all" })}
              </option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="stop-search__select-label">
            <FormattedMessage id="transit.stopSearch.operator.label" />
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              disabled={operatorOptions.length === 0}
            >
              <option value="">
                {intl.formatMessage({
                  id: "transit.stopSearch.operator.all",
                })}
              </option>
              {operatorOptions.map((op) => (
                <option key={op.gtfsId} value={op.gtfsId}>
                  {op.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {(lineCodeShortcutVisible || byLine) && (
        <p className="stop-search__line-shortcut" aria-live="polite">
          {byLine ? (
            <>
              <FormattedMessage
                id="transit.stopSearch.byLine.active"
                values={{ line: byLine }}
              />{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setByLine("");
                  setQuery("");
                }}
              >
                <FormattedMessage id="transit.stopSearch.byLine.clear" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="link-button"
              onClick={() => setByLine(debouncedQuery)}
            >
              <FormattedMessage
                id="transit.stopSearch.byLine.hint"
                values={{ line: debouncedQuery }}
              />
            </button>
          )}
        </p>
      )}

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={intl.formatMessage({
            id: "transit.stopSearch.resultsLabel",
          })}
          className="stop-search__results"
        >
          {isLoading && (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="stop-search__status"
            >
              <FormattedMessage id="locationSearch.loading" />
            </li>
          )}
          {isError && (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="stop-search__status"
            >
              <FormattedMessage id="locationSearch.error" />
            </li>
          )}
          {!isLoading && !isError && results.length === 0 && (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="stop-search__status"
            >
              <FormattedMessage id="transit.stopSearch.noResults" />
            </li>
          )}
          {results.map((stop, index) => (
            <li
              key={`${stop.gtfsId}-${stop.vehicleMode ?? "unknown"}`}
              id={`${id}-result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectResult(stop);
              }}
            >
              <span className="stop-search__name">{stop.name}</span>
              <span className="stop-search__meta">
                {stop.city && (
                  <span className="stop-search__city">{stop.city}</span>
                )}
                {stop.vehicleMode && (
                  <span className="stop-search__mode">
                    {vehicleModeLabel(stop.vehicleMode)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="visually-hidden">
        {showDropdown && !isLoading && results.length > 0
          ? intl.formatMessage(
              { id: "transit.stopSearch.resultsAnnouncement" },
              { count: results.length },
            )
          : ""}
      </div>
    </div>
  );
}
