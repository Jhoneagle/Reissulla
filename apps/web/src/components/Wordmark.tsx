import { useIntl } from "react-intl";

/**
 * Reissulla wordmark — lowercase italic "reissulla" plus an upward-right
 * arrow set in the primary token. The italic carries motion ("on a
 * trip"); the arrow is the destination glyph. Editorial, not SaaS.
 *
 * Rendered as inline SVG so the arrow stays crisp at any size and so
 * the colour tokens apply cleanly in both themes (currentColor for the
 * word, --color-primary for the arrow).
 *
 * Accessibility:
 * - `role="img"` + `aria-label="Reissulla"` — announced once, as the
 *   site name. NOT a heading; the page-level `<h1>` lives in
 *   `<PageHeading>` (visually hidden) so each route still has a proper
 *   landmark heading for SR navigation.
 * - Entrance is a one-time fade-in stagger via CSS, gated by the same
 *   reduced-motion controls as the rest of the app.
 */
export function Wordmark() {
  const intl = useIntl();
  return (
    <a
      href="/"
      className="wordmark-link"
      aria-label={intl.formatMessage({ id: "app.title" })}
    >
      <svg
        className="wordmark"
        viewBox="0 0 220 56"
        role="img"
        aria-label={intl.formatMessage({ id: "app.title" })}
        focusable="false"
      >
        <text
          x="0"
          y="42"
          className="wordmark__word"
          fontStyle="italic"
          fontWeight="400"
        >
          reissulla
        </text>
        <text
          x="180"
          y="40"
          className="wordmark__arrow"
          fontStyle="normal"
          fontWeight="400"
        >
          ↗
        </text>
      </svg>
    </a>
  );
}
