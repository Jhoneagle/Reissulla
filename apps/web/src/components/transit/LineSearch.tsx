import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import type { Line } from "@reissulla/shared";
import { useDebounce } from "../../hooks/useDebounce";
import { usePreferences } from "../../hooks/usePreferences";
import { useLineSearch, usePinnedLines } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { vehicleModeLabel, vehicleModeToken } from "../../lib/transit-utils";
import { LineCard } from "./LineCard";

interface LineSearchProps {
  id?: string;
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
 * Line search. Type a number, see lines that match across all (or one)
 * region. Each result row is a native <details> disclosure that — when
 * opened — fetches and renders the line's mini-view (direction toggle,
 * frequency strip, stop list with live status dots) inline. Picking a
 * result therefore does NOT navigate by default; the deep-link to the
 * standalone /transit/line/:gtfsId page is offered alongside for users
 * who want a full-page view or a shareable URL.
 *
 * Above the input: pinned-line chips for signed-in users, a sign-in
 * hint for anonymous ones.
 */
export function LineSearch({ id = "line-search" }: LineSearchProps) {
  const intl = useIntl();
  const user = useAuthStore((s) => s.user);
  const preferences = usePreferences();
  // Region default reads from `preferences.transitRegion` (separate from
  // persona's home city — a Tampere resident may default "all" for
  // weekend trips). Once the user picks a value from the facet, the
  // override sticks for the session even if preferences refetch.
  const [regionOverride, setRegionOverride] = useState<string | null>(null);
  const region = regionOverride ?? preferences.data?.transitRegion ?? "all";

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const regionParam = region === "all" ? undefined : region;
  // Track which lines are expanded so LineCard can skip fetching until
  // the user actually opens a row. Many results, one fetch at a time.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const { data, isLoading, isError } = useLineSearch(
    debouncedQuery,
    regionParam,
  );
  const results = useMemo<Line[]>(() => {
    const rows = data?.data ?? [];
    // Short numeric searches ("25") return long lists where exact-length
    // matches are buried under substring noise ("25A", "125", "251"). Sort
    // by shortName length ascending so canonical hits surface first;
    // preserve upstream order within length buckets.
    return [...rows].sort((a, b) => a.shortName.length - b.shortName.length);
  }, [data]);

  const pinnedQuery = usePinnedLines(Boolean(user));
  const pinned = pinnedQuery.data?.data ?? [];

  const showPinnedChips = !query && Boolean(user) && pinned.length > 0;
  const showAnonHint = !query && !user;
  const showEmptyHint = !query && Boolean(user) && pinned.length === 0;
  const showResults = debouncedQuery.length >= 1;

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
            id={id}
            type="search"
            autoComplete="off"
            placeholder={intl.formatMessage({
              id: "transit.line.search.placeholder",
            })}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

      {showResults && (
        <section
          className="line-search__results"
          aria-label={intl.formatMessage({
            id: "transit.line.search.label",
          })}
        >
          {isLoading && (
            <p className="line-search__status">
              <FormattedMessage id="locationSearch.loading" />
            </p>
          )}
          {isError && (
            <p className="line-search__status">
              <FormattedMessage id="locationSearch.error" />
            </p>
          )}
          {!isLoading && !isError && results.length === 0 && (
            <p className="line-search__status">
              <FormattedMessage id="transit.line.search.empty" />
            </p>
          )}
          {results.length > 0 && (
            <>
              <p className="visually-hidden" aria-live="polite">
                <FormattedMessage
                  id="transit.line.search.resultsAnnouncement"
                  values={{ count: results.length }}
                />
              </p>
              <ul className="line-search__list">
                {results.map((line) => {
                  const modeToken = vehicleModeToken(line.mode);
                  const isOpen = expanded.has(line.gtfsId);
                  return (
                    <li
                      key={line.gtfsId}
                      className={`line-search__row line-search__row--mode-${modeToken}`}
                    >
                      <details
                        onToggle={(e) => {
                          // Uncontrolled — native details owns the open
                          // attribute; we mirror it into state so LineCard
                          // can gate fetches until the row is opened.
                          const open = (e.currentTarget as HTMLDetailsElement)
                            .open;
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (open) next.add(line.gtfsId);
                            else next.delete(line.gtfsId);
                            return next;
                          });
                        }}
                      >
                        <summary className="line-search__summary">
                          <span
                            className={`line-search__mode-tag line-search__mode-tag--${modeToken}`}
                          >
                            {vehicleModeLabel(line.mode)}
                          </span>
                          <span className="line-search__short">
                            {line.shortName}
                          </span>
                          <span className="line-search__long">
                            {line.longName}
                          </span>
                          {line.agency?.name && (
                            <span className="line-search__agency">
                              {line.agency.name}
                            </span>
                          )}
                        </summary>
                        <div className="line-search__expanded">
                          <LineCard
                            gtfsId={line.gtfsId}
                            enabled={isOpen}
                            compact
                          />
                          <p className="line-search__open-link">
                            <Link to={lineHref(line.gtfsId)}>
                              <FormattedMessage id="transit.line.search.openPage" />
                            </Link>
                          </p>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
