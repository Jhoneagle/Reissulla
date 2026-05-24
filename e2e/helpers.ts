import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Run axe-core against the current page and fail the test if any rule
 * with impact "serious" or "critical" reports a violation. Matches the
 * roadmap done-when: "axe-core CI: 0 critical / 0 serious on every page".
 *
 * Non-critical impacts (minor / moderate) are surfaced via attached
 * results but don't fail the build.
 */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  if (serious.length > 0) {
    const summary = serious
      .map((v) => {
        const nodes = v.nodes
          .slice(0, 5)
          .map((n) => {
            const target = n.target.join(" › ");
            const reason = n.failureSummary?.replace(/\s+/g, " ") ?? "";
            return `    - ${target}\n      ${reason}`;
          })
          .join("\n");
        return `  ${v.id} (${v.impact}): ${v.help}\n${nodes}`;
      })
      .join("\n");
    throw new Error(
      `axe-core found ${serious.length} critical/serious violation(s):\n${summary}`,
    );
  }

  expect(serious).toEqual([]);
}

export function uniqueTestEmail(prefix: string): string {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2);
  return `e2e-${prefix}-${stamp}@test.reissulla.local`;
}
