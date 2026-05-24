import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";

interface SettingsNavItem {
  id: string;
  labelId: string;
}

interface SettingsNavProps {
  items: SettingsNavItem[];
}

/**
 * Sticky table-of-contents for the Settings page. Renders anchor links
 * that scroll to each fieldset, with the active section highlighted
 * via IntersectionObserver. Hidden below 48rem viewport — mobile
 * already scrolls the page linearly and a fixed sidebar wastes
 * horizontal space.
 */
export function SettingsNav({ items }: SettingsNavProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section as active. If multiple
        // are intersecting (large viewport), the first in DOM order wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.target.getBoundingClientRect().top -
              b.target.getBoundingClientRect().top,
          );
        if (visible.length > 0) {
          setActiveId(visible[0]!.target.id);
        }
      },
      // The top 96px of the viewport is roughly the sticky header area;
      // a section is "active" once its top crosses below that band.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Settings sections" className="settings-nav">
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={activeId === item.id ? "active" : undefined}
              aria-current={activeId === item.id ? "true" : undefined}
            >
              <FormattedMessage id={item.labelId} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
