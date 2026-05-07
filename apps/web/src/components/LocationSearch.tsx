import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { geocodingApi } from "@reissulla/api-client";
import type { GeocodingResult } from "@reissulla/shared";
import { useDebounce } from "../hooks/useDebounce";
import { formatAddress, formatAddressShort } from "../lib/format-address";
import { useGeolocationStore } from "../stores/geolocation";

interface LocationSearchProps {
  id?: string;
  onSelect: (result: GeocodingResult) => void;
  onResults?: (results: GeocodingResult[]) => void;
}

export function LocationSearch({
  id = "location-search",
  onSelect,
  onResults,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const geoPosition = useGeolocationStore((s) => s.position);

  const listboxId = `${id}-listbox`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["geocoding-search", debouncedQuery, geoPosition?.lat, geoPosition?.lon],
    queryFn: () =>
      geocodingApi.search(
        debouncedQuery,
        geoPosition ?? undefined,
      ),
    enabled: debouncedQuery.length >= 2,
  });

  const results = useMemo(() => data?.data ?? [], [data]);

  useEffect(() => {
    onResults?.(results);
  }, [results, onResults]);

  const prevResultsLength = useRef(0);
  useEffect(() => {
    // Open dropdown when new results arrive and input is focused
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
    (result: GeocodingResult) => {
      setQuery(formatAddressShort(result));
      setOpen(false);
      setActiveIndex(-1);
      onSelect(result);
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
          const result = results[activeIndex];
          if (result) selectResult(result);
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
    blurTimerRef.current = setTimeout(() => setOpen(false), 200);
  };

  const showDropdown = open && debouncedQuery.length >= 2;
  const activeDescendant =
    activeIndex >= 0 ? `${id}-result-${activeIndex}` : undefined;

  return (
    <div className="search-box">
      <label htmlFor={id} className="visually-hidden">
        Search locations
      </label>
      <svg
        className="search-icon"
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
        placeholder="Search for a location..."
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
          aria-label="Search results"
          className="search-results"
        >
          {isLoading && (
            <li role="option" aria-selected={false} aria-disabled="true" className="search-status">
              Searching...
            </li>
          )}
          {isError && (
            <li role="option" aria-selected={false} aria-disabled="true" className="search-status">
              Search temporarily unavailable
            </li>
          )}
          {!isLoading && !isError && results.length === 0 && (
            <li role="option" aria-selected={false} aria-disabled="true" className="search-status">
              No locations found
            </li>
          )}
          {results.map((result, index) => {
            const addr = formatAddress(result);
            return (
              <li
                key={result.placeId}
                id={`${id}-result-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectResult(result);
                }}
              >
                <span className="search-result-primary">{addr.primary}</span>
                {addr.secondary && (
                  <span className="search-result-secondary">
                    {addr.secondary}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div aria-live="polite" className="visually-hidden">
        {showDropdown && !isLoading && results.length > 0
          ? `${results.length} results available`
          : ""}
      </div>
    </div>
  );
}
