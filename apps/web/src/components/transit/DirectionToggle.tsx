import { useIntl } from "react-intl";
import type { DirectionId, Pattern } from "@reissulla/shared";

interface DirectionToggleProps {
  patterns: Pattern[];
  active: DirectionId;
  onChange: (next: DirectionId) => void;
}

/**
 * Two-chip direction switch. Renders only for lines with exactly two
 * patterns — one-way lines (length 1) skip the toggle, and tram loops
 * (length 3+ with directionId 2/3 seen in the wild) are filtered to the
 * binary 0/1 set we can actually toggle between.
 */
export function DirectionToggle({
  patterns,
  active,
  onChange,
}: DirectionToggleProps) {
  const intl = useIntl();
  const binaryPatterns = patterns.filter(
    (p): p is Pattern & { directionId: 0 | 1 } =>
      p.directionId === 0 || p.directionId === 1,
  );
  if (binaryPatterns.length !== 2) return null;

  return (
    <div
      className="direction-toggle"
      role="group"
      aria-label={intl.formatMessage({ id: "transit.line.direction.label" })}
    >
      {binaryPatterns.map((p, i) => {
        const dir: DirectionId = p.directionId;
        const arrowClass =
          i === 0
            ? "direction-toggle__arrow direction-toggle__arrow--right"
            : "direction-toggle__arrow direction-toggle__arrow--left";
        return (
          <button
            key={p.code}
            type="button"
            className={
              active === dir
                ? "direction-toggle__chip direction-toggle__chip--active"
                : "direction-toggle__chip"
            }
            aria-pressed={active === dir}
            onClick={() => onChange(dir)}
          >
            <span aria-hidden="true" className={arrowClass} />
            {p.headsign}
          </button>
        );
      })}
    </div>
  );
}
