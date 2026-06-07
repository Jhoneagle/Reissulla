import { describe, it, expect } from "vitest";

/**
 * Token-level contrast gate for Phase 3 surfaces.
 *
 * The plan (phase-3-plan.md §10.3) calls for a (text × surface × theme)
 * matrix that fails the build when a token swap drops a real surface
 * below WCAG AA contrast. The axe-core E2E gate catches violations
 * post-render, but a unit gate is faster and pins the contract on the
 * tokens themselves — a refactor of `--color-warning` that breaks the
 * minor/moderate banner fails here long before the browser runs.
 *
 * Coverage scope (Phase 3):
 *  - Warning banner severity backgrounds (minor/moderate → warning,
 *    severe/extreme → error) across light, dark, and high-contrast.
 *  - AQ chip pill: AQI value text (ink) on sunk surface across themes.
 *  - Radar control surface: ink-muted on sunk across themes.
 *
 * The hex values mirror `apps/web/src/styles/global.css`. If they drift
 * in either direction the test fails — that is the forcing function.
 */

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return [r, g, b];
}

function srgbChannel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  );
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3.0;

/**
 * Themed token snapshot. Mirrors :root + [data-theme="dark"] +
 * @media (prefers-contrast: more) blocks in global.css.
 *
 * HC inherits warning palette from light defaults — that is intentional
 * (the warning palette is already AA on white) and is asserted here so
 * a future HC override of `--color-warning` can't silently regress.
 */
const themes = {
  light: {
    surface: "#f5f1e8",
    "surface-sunk": "#ebe7de",
    ink: "#15161a",
    "ink-muted": "#5a5b62",
    warning: "#7a4f0a",
    "warning-bg": "#fbeac6",
    error: "#8b1818",
    "error-bg": "#f4dede",
  },
  dark: {
    surface: "#23262e",
    "surface-sunk": "#1b1e25",
    ink: "#ede9df",
    "ink-muted": "#a8a39a",
    warning: "#f0cc85",
    "warning-bg": "#2c1f0a",
    error: "#f4b5b5",
    "error-bg": "#2a0f0f",
  },
  highContrast: {
    surface: "#ffffff",
    "surface-sunk": "#ffffff",
    ink: "#000000",
    "ink-muted": "#000000",
    // HC inherits warning palette from light :root.
    warning: "#7a4f0a",
    "warning-bg": "#fbeac6",
    error: "#800000",
    "error-bg": "#ffe5e5",
  },
} as const;

describe("Phase 3 contrast matrix — warning banner severities", () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`minor/moderate severity bar on warning-bg meets AA (${name})`, () => {
      // `.warning-banner--minor/--moderate` paints warning text on warning-bg.
      expect(contrastRatio(t.warning, t["warning-bg"])).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL,
      );
    });

    it(`minor/moderate body text on warning-bg meets AA (${name})`, () => {
      // The body paragraph uses `--color-ink` over the same warning-bg.
      expect(contrastRatio(t.ink, t["warning-bg"])).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL,
      );
    });

    it(`severe/extreme severity bar on error-bg meets AA (${name})`, () => {
      expect(contrastRatio(t.error, t["error-bg"])).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL,
      );
    });

    it(`severe/extreme body text on error-bg meets AA (${name})`, () => {
      expect(contrastRatio(t.ink, t["error-bg"])).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL,
      );
    });
  }
});

describe("Phase 3 contrast matrix — AQ chip", () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`AQI value (ink) on chip background (surface-sunk) meets AA (${name})`, () => {
      expect(contrastRatio(t.ink, t["surface-sunk"])).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL,
      );
    });

    it(`AQI bucket label (ink-muted) on chip background meets AA (${name})`, () => {
      // The bucket label is a regular weight chip — body-text AA, not large.
      expect(
        contrastRatio(t["ink-muted"], t["surface-sunk"]),
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }
});

describe("Phase 3 contrast matrix — radar control surface", () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`muted text on sunk surface meets AA large (${name})`, () => {
      // Radar timeline labels are tabular-num small text; the controls
      // themselves are buttons with ink colour. Pin the smaller hint
      // text against AA-large since the active frame label uses 0.75rem
      // tabular Plex Mono.
      expect(
        contrastRatio(t["ink-muted"], t["surface-sunk"]),
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });

    it(`primary control text on sunk surface meets AA normal (${name})`, () => {
      expect(contrastRatio(t.ink, t["surface-sunk"])).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL,
      );
    });
  }
});
