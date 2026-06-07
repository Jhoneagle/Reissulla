import { useCallback, useState } from "react";

/**
 * User-controllable refresh cadence (DEP-14). Live uses SSE when available;
 * 30 s / 60 s polls REST at the chosen cadence; "off" disables auto-refresh
 * and the user pulls fresh data via the explicit reload button.
 */
export type RefreshChoice = "live" | "30s" | "60s" | "off";

const STORAGE_KEY = "reissulla:refresh-choice";
const ALL: ReadonlyArray<RefreshChoice> = ["live", "30s", "60s", "off"];

function isChoice(value: unknown): value is RefreshChoice {
  return (
    typeof value === "string" && (ALL as readonly string[]).includes(value)
  );
}

function readStorage(): RefreshChoice {
  if (typeof window === "undefined") return "live";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isChoice(raw) ? raw : "live";
  } catch {
    return "live";
  }
}

/**
 * Local-only refresh-cadence preference for the DepartureBoard. Per the
 * plan: per-device behavioural knob, NOT a server-side profile setting —
 * "Live" on the laptop while "60 s" on the phone is a feature, not a bug.
 *
 * Reads on mount, syncs on change. SSR-safe: the initial value is "live"
 * until the effect reads localStorage on the client.
 */
export function useRefreshChoice(): {
  choice: RefreshChoice;
  setChoice: (next: RefreshChoice) => void;
} {
  // Lazy initializer reads localStorage once on mount — no useEffect dance
  // needed because the SPA build never runs this hook server-side.
  const [choice, setChoiceState] = useState<RefreshChoice>(readStorage);

  const setChoice = useCallback((next: RefreshChoice) => {
    setChoiceState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Quota exceeded / private mode — preference stays for the session only.
    }
  }, []);

  return { choice, setChoice };
}

/**
 * The REST refetch interval (ms) implied by a refresh choice. `false` means
 * "no automatic refetch" (off, or when handled by SSE-only mode in a future
 * iteration). `live` keeps the 30 s baseline ticking under the SSE stream
 * so the FE never goes completely data-less if the SSE pipe drops.
 */
export function refreshChoiceToRestInterval(
  choice: RefreshChoice,
): number | false {
  switch (choice) {
    case "live":
      return 30_000;
    case "30s":
      return 30_000;
    case "60s":
      return 60_000;
    case "off":
      return false;
  }
}
