import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import type { Line } from "@reissulla/shared";
import { useDebounce } from "../../hooks/useDebounce";
import { usePreferences } from "../../hooks/usePreferences";
import { useLineSearch, usePinnedLines } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { vehicleModeLabel, vehicleModeToken } from "../../lib/transit-utils";

interface LineSearchProps {
  id?: string;
  onSelect?: (line: Line) => void;
}

const REGION_OPTIONS = [
  { value: "all", labelId: "transit.line.search.regionAll" },
  { value: "hsl", labelId: "transit.line.search.regionHsl" },
  { value: "waltti", labelId: "transit.line.search.regionWaltti" },
  { value: "varely", labelId: "transit.line.search.regionVarely" },
] as const;

function lineHref(gtfsId: string): string {
  return `/transit/line/${encodeURIComponent(gtfsId)}`;
}

/**
 * Line search with a region facet. Anonymous and signed-in flows differ in
 * what surfaces *below* the input when the query is empty: pinned chips for
 * signed-in users, an empty-hint for anonymous. Listbox a11y mirrors
 * `StopSearch` — combobox + listbox + aria-activedescendant.
 */
export function LineSearch({ id = "line-search", onSelect }: LineSearchProps) {
  const intl = useIntl();
  const user = useAuthStore((s) => s.user);
  const preferences = usePreferences();
  // Region default reads from `preferences.transitRegion` — separate from
  // persona's home city (a Tampere resident may default "all" for weekend
  // trips). Once the user picks a value from the facet, the override sticks
  // for the session even if preferences refetch.
  const [regionOverride, setRegionOverride] = useState<string | null>(null);
  const region = regionOverride ?? preferences.data?.transitRegion ?? "all";

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const listboxId = `${id}-listbox`;
  const regionParam = region === "all" ? undefined : region;

  const { data, isLoading, isError } = useLineSearch(
    debouncedQuery,
    regionParam,
  );
  const results = useMemo<Line[]>(() => {
    const rows = data?.data ?? [];
    // Short numeric searches like "25" return long lists where exact-length
    // matches (the actual line "25") are buried by substring noise ("25A",
    // "125", "251"). Sort by shortName length ascending so the canonical
    // hits surface first; preserve upstream order within length buckets.
    return [...rows].sort((a, b) => a.shortName.length - b.shortName.length);
  }, [data]);

  const pinnedQuery = usePinnedLines(Boolean(user));
  const pinned = pinnedQuery.data?.data ?? [];

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const selectResult = useCallback(
    (line: Line) => {
      setQuery(line.shortName);
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(line);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
          const line = results[activeIndex];
          if (line) selectResult(line);
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

  const showDropdown = open && debouncedQuery.length >= 1;
  const activeDescendant =
    activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined;

  const showPinnedChips = !query && Boolean(user) && pinned.length > 0;
  const showAnonHint = !query && !user;
  const showEmptyHint = !query && Boolean(user) && pinned.length === 0;

  return (
    <div className="line-search">
      <div className="line-search__controls">
        <label htmlFor={id} className="visually-hidden">
          <FormattedMessage id="transit.line.search.label" />
        </label>
        <div className="line-search__input-wrap">
          <svg
            className="line-search__icon"
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
              id: "transit.line.search.placeholder",
            })}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              setOpen(e.target.value.trim().length >= 1);
            }}
            onFocus={() => {
              if (query.trim().length >= 1) setOpen(true);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        </div>
        <label htmlFor={`${id}-region`} className="visually-hidden">
          <FormattedMessage id="transit.line.search.region" />
        </label>
        <select
          id={`${id}-region`}
          className="line-search__region"
          value={region}
          onChange={(e) => setRegionOverride(e.target.value)}
        >
          {REGION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {intl.formatMessage({ id: opt.labelId })}
            </option>
          ))}
        </select>
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={intl.formatMessage({
            id: "transit.line.search.label",
          })}
          className="line-search__results"
        >
          {isLoading && (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="line-search__status"
            >
              <FormattedMessage id="locationSearch.loading" />
            </li>
          )}
          {isError && (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="line-search__status"
            >
              <FormattedMessage id="locationSearch.error" />
            </li>
          )}
          {!isLoading && !isError && results.length === 0 && (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className="line-search__status"
            >
              <FormattedMessage id="transit.line.search.empty" />
            </li>
          )}
          {results.map((line, index) => {
            const modeToken = vehicleModeToken(line.mode);
            return (
              <li
                key={line.gtfsId}
                id={`${id}-result-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`line-search__row line-search__row--mode-${modeToken}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectResult(line);
                }}
              >
                <Link
                  to={lineHref(line.gtfsId)}
                  className="line-search__link"
                  onClick={() => {
                    setOpen(false);
                    setActiveIndex(-1);
                  }}
                >
                  <span
                    className={`line-search__mode-tag line-search__mode-tag--${modeToken}`}
                  >
                    {vehicleModeLabel(line.mode)}
                  </span>
                  <span className="line-search__short">{line.shortName}</span>
                  <span className="line-search__long">{line.longName}</span>
                  {line.agency?.name && (
                    <span className="line-search__agency">
                      {line.agency.name}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showPinnedChips && (
        <nav
          className="line-search__pins"
          aria-label={intl.formatMessage({
            id: "transit.line.pinned.heading",
          })}
        >
          <p className="line-search__pins-heading">
            <FormattedMessage id="transit.line.pinned.heading" />
          </p>
          <ul className="line-search__pins-list">
            {pinned.map((pin) => {
              const modeToken = vehicleModeToken(pin.vehicleMode);
              return (
                <li key={pin.id}>
                  <Link
                    to={lineHref(pin.gtfsId)}
                    className={`line-search__chip line-search__chip--mode-${modeToken}`}
                  >
                    <span
                      className={`line-search__mode-tag line-search__mode-tag--${modeToken}`}
                    >
                      {vehicleModeLabel(pin.vehicleMode)}
                    </span>
                    <span className="line-search__chip-name">{pin.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {showAnonHint && (
        <p className="line-search__hint">
          <FormattedMessage id="transit.line.pinned.signinHint" />
        </p>
      )}
      {showEmptyHint && (
        <p className="line-search__hint">
          <FormattedMessage id="transit.line.pinned.emptyHint" />
        </p>
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
