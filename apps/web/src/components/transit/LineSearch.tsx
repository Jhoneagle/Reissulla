import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, useLocation } from "react-router";
import type { Line } from "@reissulla/shared";
import { useDebounce } from "../../hooks/useDebounce";
import { usePreferences } from "../../hooks/usePreferences";
import { useLineSearch, usePinnedLines } from "../../hooks/useTransit";
import { useAuthStore } from "../../stores/auth";
import { vehicleModeLabel, vehicleModeToken } from "../../lib/transit-utils";

interface LineSearchProps {
  id?: string;
  /** URL-driven committed query (?q=). Empty string when not set. */
  query: string;
  /** URL-driven region (?region=). Empty string when not set. */
  region: string;
  /** Called with the debounced typing buffer. Parent writes ?q= to URL. */
  onQueryCommit: (next: string) => void;
  /** Called when the region facet changes. Parent writes ?region= to URL. */
  onRegionChange: (next: string) => void;
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

// Decorative chevron. Referenced as an identifier so the i18n literal-string
// rule skips it; the host span is aria-hidden, so SRs don't speak it.
const CHEVRON = "›";

/**
 * Line search. Type a number, see lines that match across all (or one)
 * region. Each result row is a Link to /transit/line/:gtfsId — picking
 * a result navigates straight to the standalone line page. The
 * originating URL is round-tripped via router state so the page's
 * back-link returns here with the search query and region intact.
 *
 * Above the input: pinned-line chips for signed-in users, a sign-in
 * hint for anonymous ones.
 */
export function LineSearch({
  id = "line-search",
  query,
  region: regionProp,
  onQueryCommit,
  onRegionChange,
}: LineSearchProps) {
  const intl = useIntl();
  const location = useLocation();
  // Round-trip the originating URL through router state so the line/trip
  // detail back-links can return to the same search context. Read once
  // per render; navigation captures the snapshot.
  const fromHere = `${location.pathname}${location.search}`;
  const user = useAuthStore((s) => s.user);
  const preferences = usePreferences();
  // Region default reads from `preferences.transitRegion` (separate from
  // persona's home city — a Tampere resident may default "all" for
  // weekend trips). The URL wins; preferences fill in for new sessions.
  const region = regionProp || preferences.data?.transitRegion || "all";

  // Local typing buffer — the input responds to every keystroke. The
  // debounced value is what we commit to the URL via onQueryCommit, so
  // each keystroke does not flood history.
  const [buffer, setBuffer] = useState(query);
  // Sync the buffer down when the URL changes underneath us (back/forward
  // navigation, programmatic update). The "previous query" sentinel runs
  // during render — React-idiomatic alternative to a setState-in-effect,
  // which is now flagged by react-hooks/set-state-in-effect.
  const [lastSyncedQuery, setLastSyncedQuery] = useState(query);
  if (query !== lastSyncedQuery) {
    setLastSyncedQuery(query);
    setBuffer(query);
  }
  const debouncedBuffer = useDebounce(buffer.trim(), 300);
  useEffect(() => {
    if (debouncedBuffer !== query) onQueryCommit(debouncedBuffer);
  }, [debouncedBuffer, query, onQueryCommit]);

  const regionParam = region === "all" ? undefined : region;

  const { data, isLoading, isError } = useLineSearch(
    debouncedBuffer,
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

  // Auto-focus on mount only if we arrived with a populated search (back-link
  // round-trip). jsx-a11y/no-autofocus forbids the JSX prop, so do it
  // imperatively. `shouldAutoFocus` is captured from the initial render via
  // useState's lazy initializer — later prop changes don't re-trigger focus.
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shouldAutoFocus] = useState(() => query.length > 0);
  useEffect(() => {
    if (shouldAutoFocus) inputRef.current?.focus();
  }, [shouldAutoFocus]);

  const showPinnedChips = !buffer && Boolean(user) && pinned.length > 0;
  const showAnonHint = !buffer && !user;
  const showEmptyHint = !buffer && Boolean(user) && pinned.length === 0;
  const showResults = debouncedBuffer.length >= 1;

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
            type="search"
            autoComplete="off"
            placeholder={intl.formatMessage({
              id: "transit.line.search.placeholder",
            })}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </div>
        <label htmlFor={`${id}-region`} className="visually-hidden">
          <FormattedMessage id="transit.line.search.region" />
        </label>
        <select
          id={`${id}-region`}
          className="line-search__region"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
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
                    state={{ from: fromHere }}
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
              <FormattedMessage id="transit.line.search.loading" />
            </p>
          )}
          {isError && (
            <p className="line-search__status">
              <FormattedMessage id="transit.line.search.error" />
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
                  return (
                    <li
                      key={line.gtfsId}
                      className={`line-search__row line-search__row--mode-${modeToken}`}
                    >
                      <Link
                        to={lineHref(line.gtfsId)}
                        state={{ from: fromHere }}
                        className="line-search__row-link"
                      >
                        <span
                          className={`line-search__mode-tag line-search__mode-tag--${modeToken}`}
                          aria-hidden="true"
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
                        <span
                          className="line-search__chevron"
                          aria-hidden="true"
                        >
                          {CHEVRON}
                        </span>
                      </Link>
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
