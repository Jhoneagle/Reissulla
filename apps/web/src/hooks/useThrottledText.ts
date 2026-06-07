import { useEffect, useRef, useState } from "react";

/**
 * Hold a streaming text value until at least `minIntervalMs` has passed
 * since the last release. Drives the dashboard nowcast live region so a
 * fast cache-miss / cache-hit flip doesn't chatter at the screen reader;
 * the visible DOM text mirrors the announced value so sighted and
 * non-sighted users see the same thing.
 *
 * All state updates go through `setTimeout` callbacks so the synchronous
 * effect body stays setState-free.
 */
export function useThrottledText(text: string, minIntervalMs: number): string {
  const [announced, setAnnounced] = useState("");
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (text === announced) return;
    if (text.length === 0) {
      const handle = setTimeout(() => setAnnounced(""), 0);
      return () => clearTimeout(handle);
    }
    const now = Date.now();
    const elapsed =
      lastAtRef.current === 0 ? Infinity : now - lastAtRef.current;
    const wait = Math.max(0, minIntervalMs - elapsed);
    const handle = setTimeout(() => {
      lastAtRef.current = Date.now();
      setAnnounced(text);
    }, wait);
    return () => clearTimeout(handle);
  }, [text, announced, minIntervalMs]);

  return announced;
}
