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

/**
 * Find a stop by name. Results carry city + mode labels per row — that's
 * the disambiguation. Multiple "Rautatieasema" hits across cities, or a
 * Bus / Tram / Subway split at the same name, surface as separate
 * grouped rows in the results list; the user picks the one they want.
 *
 * No extra filter chips here: per-row labels already do the job, and the
 * "find a line" affordance lives in its own Lines tab — not under stop
 * search.
 */
export function StopSearch({ id = "stop-search", onSelect }: StopSearchProps) {
  const intl = useIntl();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const listboxId = `${id}-listbox`;

  const { data, isLoading, isError } = useStopSearch(debouncedQuery);
  const results = useMemo(() => data?.data ?? [], [data]);

  const prevResultsLength = useRef(0);
  useEffect(() => {
    if (
      results.length > 0 &&
      prevResultsLength.current === 0 &&
      debouncedQuery.length >= 2
    ) {
      setOpen(true);
    }
    prevResultsLength.current = results.length;
  }, [results.length, debouncedQuery.length]);

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

  const showDropdown = open && debouncedQuery.length >= 2;
  const activeDescendant =
    activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined;

  return (
    <div className="stop-search">
      <label htmlFor={id} className="visually-hidden">
        <FormattedMessage id="transit.stopSearch.inputLabel" />
      </label>
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
          if (e.target.value.trim().length < 2) setOpen(false);
        }}
        onFocus={() => {
          if (results.length > 0 && debouncedQuery.length >= 2) setOpen(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

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
