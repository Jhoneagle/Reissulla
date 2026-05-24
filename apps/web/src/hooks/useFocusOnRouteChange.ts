import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

/**
 * After every route change (but not the initial render), move keyboard
 * focus to the target element. Screen-reader users hear the new page
 * announced; sighted keyboard users land near the start of the page.
 *
 * Default target is `#main-content` from Layout.tsx, which is rendered
 * with `tabindex="-1"` so it's programmatically focusable without entering
 * the tab order. Roadmap A11Y-25.
 */
export function useFocusOnRouteChange(targetId: string = "main-content"): void {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const target = document.getElementById(targetId);
    target?.focus();
  }, [location.pathname, targetId]);
}
