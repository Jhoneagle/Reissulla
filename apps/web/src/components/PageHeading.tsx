import { useEffect, useId, useRef } from "react";
import { FormattedMessage } from "react-intl";
import { useLocation } from "react-router";

interface PageHeadingProps {
  /** i18n key for the heading text — Settings = "settings.heading", etc. */
  id: string;
}

/**
 * Visually-hidden `<h1>` for each route. The site wordmark is rendered
 * as an SVG with `role="img"` (not a heading), so this is what gives
 * each page its landmark heading and the announcement target for
 * route-change focus.
 *
 * On every route change after the initial render, focus moves here so
 * screen-readers announce the new page by its title. Sighted keyboard
 * users land at the very top of the new content. This replaces the
 * generic `useFocusOnRouteChange` → `#main-content` handoff for routes
 * that mount a PageHeading; routes without one fall back to that hook.
 */
export function PageHeading({ id }: PageHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    ref.current?.focus();
  }, [location.pathname]);

  return (
    <h1 ref={ref} id={headingId} className="visually-hidden" tabIndex={-1}>
      <FormattedMessage id={id} />
    </h1>
  );
}
