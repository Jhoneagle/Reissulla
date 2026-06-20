import { useEffect, useState, type FormEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, useNavigate, useSearchParams } from "react-router";
import { accountApi, ApiError, meApi } from "@reissulla/api-client";
import {
  DEFAULT_LIVE_REGION,
  type LiveRegionPrefs,
  type Persona,
  type ReadingPace,
  type Verbosity,
} from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";
import { usePersonaStore } from "../stores/persona";
import { usePreferences, useUpdatePreferences } from "../hooks/usePreferences";
import { changeLocale, type Locale } from "../i18n";
import { PersonaWizard } from "../components/PersonaWizard";
import { PersonaBanner } from "../components/PersonaBanner";
import { SavedLocationsManager } from "../components/SavedLocationsManager";
import { RecentPlacesList } from "../components/RecentPlacesList";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { showToast } from "../stores/toast";
import { SettingsNav } from "../components/SettingsNav";

// Ordering decision (W3.1): Profile is the most personal, Display next
// (most users want to set theme/text size early), Persona right after
// so the accessibility profile is high-prominence. Recent Places is
// hoisted above Saved Locations because it's the data source for
// future deletion CTAs and gets re-read more often. Units is calmer
// (rarely changed once set). Account stays last — destructive end
// matches the cleanup-as-finale pattern in most settings UIs.
const SETTINGS_SECTIONS = [
  { id: "settings-profile", labelId: "settings.section.profile" },
  { id: "settings-display", labelId: "settings.section.display" },
  { id: "settings-persona", labelId: "settings.section.persona" },
  { id: "settings-recent", labelId: "settings.section.recentPlaces" },
  { id: "settings-locations", labelId: "settings.section.locations" },
  { id: "settings-units", labelId: "settings.section.units" },
  { id: "settings-account", labelId: "settings.section.account" },
] as const;

const PERSONA_FLAGS: ReadonlyArray<{
  key: keyof Persona;
  labelId: string;
}> = [
  { key: "wheelchair", labelId: "settings.persona.wheelchair" },
  { key: "lowFloor", labelId: "settings.persona.lowFloor" },
  { key: "noStairs", labelId: "settings.persona.noStairs" },
  { key: "stroller", labelId: "settings.persona.stroller" },
  { key: "screenReader", labelId: "settings.persona.screenReader" },
  { key: "lowVision", labelId: "settings.persona.lowVision" },
];

export function Settings() {
  const user = useAuthStore((s) => s.user);
  const personaStore = usePersonaStore();
  const preferencesQuery = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const intl = useIntl();

  const prefs = preferencesQuery.data;
  const [searchParams, setSearchParams] = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(
    () => searchParams.get("wizard") === "1",
  );

  // Drop the `?wizard=1` flag once the user opens or skips the wizard so a
  // back-button + refresh doesn't pop it again.
  useEffect(() => {
    if (searchParams.get("wizard")) {
      const next = new URLSearchParams(searchParams);
      next.delete("wizard");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync server-side persona into the local store when authenticated. The
  // local store is the wire-header source of truth, so this keeps both
  // halves consistent after a fresh login.
  useEffect(() => {
    if (prefs?.extra.persona) {
      personaStore.replace(prefs.extra.persona);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.extra.persona]);

  // Push display tokens to the document so the page reflects the user's
  // settings live (font scale, high contrast, sr-optimised, reduce
  // motion). The reduceMotion preference maps:
  //   "on"     → body[data-reduce-motion="true"]  (kills ambient motion)
  //   "off"    → body[data-reduce-motion="false"] (force-on even if OS reduce)
  //   "system" → attribute removed; CSS falls back to the OS preference
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scale = (prefs?.fontScale ?? 100) / 100;
    html.style.setProperty("--font-scale", String(scale));
    body.dataset.highContrast = prefs?.highContrast ? "true" : "false";
    body.dataset.srOptimised = prefs?.srOptimised ? "true" : "false";
    const reduce = prefs?.reduceMotion;
    if (reduce === "on") body.dataset.reduceMotion = "true";
    else if (reduce === "off") body.dataset.reduceMotion = "false";
    else delete body.dataset.reduceMotion;
  }, [
    prefs?.fontScale,
    prefs?.highContrast,
    prefs?.srOptimised,
    prefs?.reduceMotion,
  ]);

  async function patch(
    update: Parameters<typeof updatePreferences.mutateAsync>[0],
  ) {
    try {
      await updatePreferences.mutateAsync(update);
      showToast({
        message: intl.formatMessage({ id: "settings.savedToast" }),
        kind: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" });
      showToast({ message, kind: "error" });
    }
  }

  function setLanguage(language: Locale) {
    changeLocale(language);
    if (user) void patch({ language });
  }

  function setPersonaFlag(key: keyof Persona, value: boolean) {
    personaStore.set({ [key]: value } as Partial<Persona>);
    if (user) {
      void patch({
        extra: {
          ...prefs?.extra,
          persona: { ...personaStore.persona, [key]: value },
        },
      });
    }
  }

  // A11Y-23 / A11Y-29 — live-region announcement tuning, persisted on
  // preferences.extra.liveRegion. Merge so changing one member preserves
  // the other.
  function setLiveRegion(partial: Partial<LiveRegionPrefs>) {
    const current = prefs?.extra.liveRegion ?? DEFAULT_LIVE_REGION;
    void patch({
      extra: {
        ...prefs?.extra,
        liveRegion: { ...current, ...partial },
      },
    });
  }

  if (!user) {
    return (
      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">
          <FormattedMessage id="settings.heading" />
        </h2>
        <AnonymousPersonaSection
          persona={personaStore.persona}
          onChange={(key, value) =>
            personaStore.set({ [key]: value } as Partial<Persona>)
          }
        />
      </section>
    );
  }

  if (preferencesQuery.isLoading) {
    return (
      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">
          <FormattedMessage id="settings.heading" />
        </h2>
        <p role="status">
          <FormattedMessage id="settings.loading" />
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="settings-heading" className="settings-page">
      <h2 id="settings-heading">
        <FormattedMessage id="settings.heading" />
      </h2>

      <div className="settings-page__layout">
        <SettingsNav items={[...SETTINGS_SECTIONS]} />

        <div className="settings-page__content">
          <PersonaBanner onOpenWizard={() => setWizardOpen(true)} />
          <ProfileSection id="settings-profile" currentName={user.name} />

          <fieldset id="settings-display">
            <legend>
              <FormattedMessage id="settings.section.display" />
            </legend>

            <SelectField
              id="language"
              labelId="settings.language.label"
              value={prefs?.language ?? "en"}
              onChange={(v) => setLanguage(v as Locale)}
              options={[
                { value: "fi", labelId: "settings.language.fi" },
                { value: "en", labelId: "settings.language.en" },
              ]}
            />

            <SelectField
              id="theme"
              labelId="settings.theme.label"
              value={prefs?.theme ?? "system"}
              onChange={(v) =>
                patch({ theme: v as "light" | "dark" | "system" })
              }
              options={[
                { value: "system", labelId: "settings.theme.system" },
                { value: "light", labelId: "settings.theme.light" },
                { value: "dark", labelId: "settings.theme.dark" },
              ]}
            />

            <BooleanField
              id="highContrast"
              labelId="settings.highContrast.label"
              value={prefs?.highContrast ?? false}
              onChange={(v) => patch({ highContrast: v })}
            />

            <div className="form-field">
              <label htmlFor="fontScale">
                <FormattedMessage id="settings.fontScale.label" />
              </label>
              {/* Keep the live percent OUT of the <label>: when the slider
                  changes, the label's accessible name would otherwise
                  update and SRs re-announce the whole control. */}
              <span
                id="fontScale-value"
                aria-live="polite"
                className="form-field__value"
              >
                <FormattedMessage
                  id="settings.fontScale.percent"
                  values={{ percent: prefs?.fontScale ?? 100 }}
                />
              </span>
              <input
                id="fontScale"
                type="range"
                min={100}
                max={200}
                step={10}
                value={prefs?.fontScale ?? 100}
                aria-describedby="fontScale-value"
                onChange={(e) =>
                  void patch({ fontScale: Number(e.currentTarget.value) })
                }
              />
              {/* Live preview: the slider value is just a number, but
                  the *feel* of "150%" vs "100%" is what matters. The
                  sentence is decorative (the slider already carries the
                  semantic value via aria-describedby), so we hide it
                  from SR to avoid double-announcement. */}
              <p
                aria-hidden="true"
                className="form-field__preview"
                style={{
                  fontSize: `calc(1rem * ${(prefs?.fontScale ?? 100) / 100})`,
                }}
              >
                <FormattedMessage id="settings.fontScale.sample" />
              </p>
            </div>

            <SelectField
              id="reduceMotion"
              labelId="settings.reduceMotion.label"
              value={prefs?.reduceMotion ?? "system"}
              onChange={(v) =>
                patch({ reduceMotion: v as "on" | "off" | "system" })
              }
              options={[
                { value: "system", labelId: "settings.reduceMotion.system" },
                { value: "on", labelId: "settings.reduceMotion.on" },
                { value: "off", labelId: "settings.reduceMotion.off" },
              ]}
            />

            <div className="form-field">
              <BooleanField
                id="srOptimised"
                labelId="settings.srOptimised.label"
                value={prefs?.srOptimised ?? false}
                onChange={(v) => patch({ srOptimised: v })}
              />
              <p className="help">
                <FormattedMessage id="settings.srOptimised.help" />
              </p>
            </div>
          </fieldset>

          <fieldset id="settings-persona">
            <legend>
              <FormattedMessage id="settings.section.persona" />
            </legend>
            <div className="form-field">
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="btn btn--secondary"
              >
                <FormattedMessage id="personaWizard.openButton" />
              </button>
            </div>
            {PERSONA_FLAGS.map(({ key, labelId }) => (
              <BooleanField
                key={key}
                id={`persona-${key}`}
                labelId={labelId}
                value={Boolean(personaStore.persona[key])}
                onChange={(v) => setPersonaFlag(key, v)}
              />
            ))}

            <div className="form-field">
              <label htmlFor="readingPace">
                <FormattedMessage id="settings.readingPace.label" />
              </label>
              <select
                id="readingPace"
                aria-describedby="readingPace-help"
                value={prefs?.extra.liveRegion?.readingPace ?? "normal"}
                onChange={(e) =>
                  setLiveRegion({
                    readingPace: e.currentTarget.value as ReadingPace,
                  })
                }
              >
                <option value="slow">
                  {intl.formatMessage({ id: "settings.readingPace.slow" })}
                </option>
                <option value="normal">
                  {intl.formatMessage({ id: "settings.readingPace.normal" })}
                </option>
                <option value="fast">
                  {intl.formatMessage({ id: "settings.readingPace.fast" })}
                </option>
              </select>
              <p id="readingPace-help" className="help">
                <FormattedMessage id="settings.readingPace.help" />
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="verbosity">
                <FormattedMessage id="settings.verbosity.label" />
              </label>
              <select
                id="verbosity"
                aria-describedby="verbosity-help"
                value={prefs?.extra.liveRegion?.verbosity ?? "standard"}
                onChange={(e) =>
                  setLiveRegion({
                    verbosity: e.currentTarget.value as Verbosity,
                  })
                }
              >
                <option value="terse">
                  {intl.formatMessage({ id: "settings.verbosity.terse" })}
                </option>
                <option value="standard">
                  {intl.formatMessage({ id: "settings.verbosity.standard" })}
                </option>
                <option value="verbose">
                  {intl.formatMessage({ id: "settings.verbosity.verbose" })}
                </option>
              </select>
              <p id="verbosity-help" className="help">
                <FormattedMessage id="settings.verbosity.help" />
              </p>
            </div>
          </fieldset>

          <PersonaWizard
            isOpen={wizardOpen}
            onClose={() => setWizardOpen(false)}
          />

          <fieldset id="settings-recent">
            <legend>
              <FormattedMessage id="settings.section.recentPlaces" />
            </legend>
            <RecentPlacesList />
          </fieldset>

          <fieldset id="settings-locations">
            <legend>
              <FormattedMessage id="settings.section.locations" />
            </legend>
            <SavedLocationsManager />
          </fieldset>

          <fieldset id="settings-units">
            <legend>
              <FormattedMessage id="settings.section.units" />
            </legend>

            <SelectField
              id="temperatureUnit"
              labelId="settings.tempUnit.label"
              value={prefs?.temperatureUnit ?? "celsius"}
              onChange={(v) =>
                patch({ temperatureUnit: v as "celsius" | "fahrenheit" })
              }
              options={[
                { value: "celsius", labelId: "settings.tempUnit.celsius" },
                {
                  value: "fahrenheit",
                  labelId: "settings.tempUnit.fahrenheit",
                },
              ]}
            />

            <SelectField
              id="distanceUnit"
              labelId="settings.distanceUnit.label"
              value={prefs?.distanceUnit ?? "metric"}
              onChange={(v) =>
                patch({ distanceUnit: v as "metric" | "imperial" })
              }
              options={[
                { value: "metric", labelId: "settings.distanceUnit.metric" },
                {
                  value: "imperial",
                  labelId: "settings.distanceUnit.imperial",
                },
              ]}
            />

            <SelectField
              id="timeFormat"
              labelId="settings.timeFormat.label"
              value={prefs?.timeFormat ?? "24h"}
              onChange={(v) => patch({ timeFormat: v as "24h" | "12h" })}
              options={[
                { value: "24h", labelId: "settings.timeFormat.24h" },
                { value: "12h", labelId: "settings.timeFormat.12h" },
              ]}
            />
          </fieldset>

          <AccountSection id="settings-account" />
        </div>
      </div>
    </section>
  );
}

function ProfileSection({
  id,
  currentName,
}: {
  id: string;
  currentName: string;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const intl = useIntl();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await meApi.updateName(name);
      showToast({
        message: intl.formatMessage({ id: "settings.savedToast" }),
        kind: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" });
      showToast({ message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset id={id}>
      <legend>
        <FormattedMessage id="settings.section.profile" />
      </legend>
      <form onSubmit={handleSubmit} className="form-field">
        <label htmlFor="profile-name">
          <FormattedMessage id="settings.profile.name" />
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={1}
          maxLength={255}
          required
        />
        <button
          type="submit"
          disabled={saving || name === currentName}
          className="btn btn--primary"
        >
          <FormattedMessage
            id={saving ? "settings.profile.saving" : "settings.profile.save"}
          />
        </button>
      </form>
    </fieldset>
  );
}

function AccountSection({ id }: { id: string }) {
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const intl = useIntl();
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirm();

  // Navigate home AFTER the live-region message has rendered (one tick
  // later via useEffect). SRs queue aria-live updates at the moment the
  // change is committed, so the announcement survives the unmount.
  useEffect(() => {
    if (deleted) {
      navigate("/", { replace: true });
    }
  }, [deleted, navigate]);

  async function downloadExport() {
    const data = await accountApi.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reissulla-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: intl.formatMessage({ id: "settings.account.deleteConfirm" }),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await accountApi.remove();
      await signOut();
      setDeleted(true);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <fieldset id={id}>
      <legend>
        <FormattedMessage id="settings.section.account" />
      </legend>
      <div className="form-field">
        <button
          type="button"
          onClick={() => void downloadExport()}
          className="btn btn--secondary"
        >
          <FormattedMessage id="settings.account.export" />
        </button>
        <p className="help">
          <FormattedMessage id="settings.account.exportHelp" />
        </p>
      </div>
      <div className="form-field">
        <button
          type="button"
          onClick={() => void deleteAccount()}
          disabled={deleting}
          className="btn btn--destructive"
        >
          <FormattedMessage
            id={
              deleting ? "settings.account.deleting" : "settings.account.delete"
            }
          />
        </button>
      </div>
      <div role="status" aria-live="polite" className="visually-hidden">
        {deleted && (
          <FormattedMessage id="settings.account.deletedAnnouncement" />
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </fieldset>
  );
}

function AnonymousPersonaSection({
  persona,
  onChange,
}: {
  persona: Persona;
  onChange: (key: keyof Persona, value: boolean) => void;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  return (
    <>
      <aside className="cta-card" aria-labelledby="settings-cta-heading">
        <h3 id="settings-cta-heading" className="cta-card__heading">
          <FormattedMessage id="settings.anonymous.cta.heading" />
        </h3>
        <p className="cta-card__description">
          <FormattedMessage id="settings.anonymous.cta.description" />
        </p>
        <div className="cta-card__actions">
          <Link to="/login" className="btn btn--primary">
            <FormattedMessage id="settings.anonymous.cta.signIn" />
          </Link>
          <Link to="/register" className="btn btn--secondary">
            <FormattedMessage id="settings.anonymous.cta.createAccount" />
          </Link>
        </div>
      </aside>
      <fieldset>
        <legend>
          <FormattedMessage id="settings.section.persona" />
        </legend>
        <p className="help">
          <FormattedMessage id="settings.persona.localOnly" />
        </p>
        <div className="form-field">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="btn btn--secondary"
          >
            <FormattedMessage id="personaWizard.openButton" />
          </button>
        </div>
        {PERSONA_FLAGS.map(({ key, labelId }) => (
          <BooleanField
            key={key}
            id={`persona-${key}`}
            labelId={labelId}
            value={Boolean(persona[key])}
            onChange={(v) => onChange(key, v)}
          />
        ))}
      </fieldset>
      <PersonaWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  );
}

// Generic field helpers — keep the page readable.

function SelectField({
  id,
  labelId,
  value,
  onChange,
  options,
}: {
  id: string;
  labelId: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; labelId: string }[];
}) {
  const intl = useIntl();
  return (
    <div className="form-field">
      <label htmlFor={id}>
        <FormattedMessage id={labelId} />
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {intl.formatMessage({ id: o.labelId })}
          </option>
        ))}
      </select>
    </div>
  );
}

function BooleanField({
  id,
  labelId,
  value,
  onChange,
}: {
  id: string;
  labelId: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="form-field form-field-inline">
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <label htmlFor={id}>
        <FormattedMessage id={labelId} />
      </label>
    </div>
  );
}
