import type { StopRowProps } from "./types";

const SR_STATE_PREFIX: Partial<Record<StopRowProps["state"], string>> = {
  past: "Aiempi pysäkki: ",
  current: "Nykyinen pysäkki: ",
};

/**
 * One row in the trip-detail / line-view stop list.
 *
 * Spine + dot are decorative (aria-hidden). Past/current state is conveyed
 * via:
 *   - aria-current="true" on the <li> (native HTML, no role acrobatics),
 *   - a visually-hidden Finnish prefix in front of the stop name.
 */
export function StopRow({ name, secondary, time, state }: StopRowProps) {
  const ariaCurrent = state === "current" ? "true" : undefined;
  const prefix = SR_STATE_PREFIX[state];

  return (
    <li className={`stop-row stop-row--${state}`} aria-current={ariaCurrent}>
      <span className="stop-row__spine" aria-hidden="true">
        <span className={`stop-row__dot stop-row__dot--${state}`} />
      </span>
      <div className="stop-row__body">
        {prefix && <span className="visually-hidden">{prefix}</span>}
        <span className="stop-row__name">{name}</span>
        {secondary && <span className="stop-row__secondary">{secondary}</span>}
      </div>
      <div className="stop-row__time">{time}</div>
    </li>
  );
}
