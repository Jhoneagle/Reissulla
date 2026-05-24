import { FormattedMessage } from "react-intl";
import { usePreferences, useUpdatePreferences } from "../hooks/usePreferences";

/**
 * A second-chance nudge to set up the accessibility profile. Shown on
 * the authed Settings page when:
 *   - the user has never configured a persona, AND
 *   - they haven't dismissed this banner before.
 *
 * The post-register auto-modal (Register.tsx → /settings?wizard=1) is
 * the primary onboarding path. Users who skip the wizard there often
 * never circle back, since the "Aseta saavutettavuusprofiili" button
 * is one fieldset deep in the persona section. This banner sits at
 * the top of Settings as a passive reminder until either acted on or
 * explicitly dismissed.
 *
 * The parent owns the wizard open-state — clicking "Set up" calls
 * the `onOpenWizard` callback to mount the existing PersonaWizard.
 */
export function PersonaBanner({ onOpenWizard }: { onOpenWizard: () => void }) {
  const prefs = usePreferences().data;
  const updatePreferences = useUpdatePreferences();

  const hasPersona = prefs?.extra?.persona !== undefined;
  const dismissed = prefs?.extra?.personaBannerDismissed === true;
  if (!prefs || hasPersona || dismissed) return null;

  function dismiss() {
    void updatePreferences.mutateAsync({
      extra: {
        ...prefs!.extra,
        personaBannerDismissed: true,
      },
    });
  }

  return (
    <aside
      className="cta-card persona-banner"
      aria-labelledby="persona-banner-heading"
    >
      <h3 id="persona-banner-heading" className="cta-card__heading">
        <FormattedMessage id="settings.personaBanner.heading" />
      </h3>
      <p className="cta-card__description">
        <FormattedMessage id="settings.personaBanner.description" />
      </p>
      <div className="cta-card__actions">
        <button
          type="button"
          onClick={onOpenWizard}
          className="btn btn--primary"
        >
          <FormattedMessage id="settings.personaBanner.cta.setUp" />
        </button>
        <button type="button" onClick={dismiss} className="btn btn--secondary">
          <FormattedMessage id="settings.personaBanner.cta.dismiss" />
        </button>
      </div>
    </aside>
  );
}
