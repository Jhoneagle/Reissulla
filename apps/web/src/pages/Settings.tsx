import { useEffect, useState, type FormEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { accountApi, ApiError, meApi } from "@reissulla/api-client";
import type { Persona } from "@reissulla/shared";
import { useAuthStore } from "../stores/auth";
import { usePersonaStore } from "../stores/persona";
import { usePreferences, useUpdatePreferences } from "../hooks/usePreferences";
import { changeLocale, type Locale } from "../i18n";

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
  const [saveError, setSaveError] = useState<string | null>(null);

  const prefs = preferencesQuery.data;

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
  // settings live (font scale, high contrast, sr-optimised, reduce motion).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scale = (prefs?.fontScale ?? 100) / 100;
    html.style.setProperty("--font-scale", String(scale));
    body.dataset.highContrast = prefs?.highContrast ? "true" : "false";
    body.dataset.srOptimised = prefs?.srOptimised ? "true" : "false";
  }, [prefs?.fontScale, prefs?.highContrast, prefs?.srOptimised]);

  async function patch(
    update: Parameters<typeof updatePreferences.mutateAsync>[0],
  ) {
    setSaveError(null);
    try {
      await updatePreferences.mutateAsync(update);
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" }),
      );
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

  if (!user) {
    return (
      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">
          <FormattedMessage id="settings.heading" />
        </h2>
        <p role="status">
          <FormattedMessage id="settings.notSignedIn" />
        </p>
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

      {saveError && (
        <div role="alert" className="form-error">
          {saveError}
        </div>
      )}

      <ProfileSection currentName={user.name} />

      <fieldset>
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
          onChange={(v) => patch({ theme: v as "light" | "dark" | "system" })}
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
            <FormattedMessage id="settings.fontScale.label" />{" "}
            <span aria-live="polite">
              <FormattedMessage
                id="settings.fontScale.percent"
                values={{ percent: prefs?.fontScale ?? 100 }}
              />
            </span>
          </label>
          <input
            id="fontScale"
            type="range"
            min={100}
            max={200}
            step={10}
            value={prefs?.fontScale ?? 100}
            onChange={(e) =>
              void patch({ fontScale: Number(e.currentTarget.value) })
            }
          />
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

      <fieldset>
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
            { value: "fahrenheit", labelId: "settings.tempUnit.fahrenheit" },
          ]}
        />

        <SelectField
          id="distanceUnit"
          labelId="settings.distanceUnit.label"
          value={prefs?.distanceUnit ?? "metric"}
          onChange={(v) => patch({ distanceUnit: v as "metric" | "imperial" })}
          options={[
            { value: "metric", labelId: "settings.distanceUnit.metric" },
            { value: "imperial", labelId: "settings.distanceUnit.imperial" },
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

      <fieldset>
        <legend>
          <FormattedMessage id="settings.section.persona" />
        </legend>
        {PERSONA_FLAGS.map(({ key, labelId }) => (
          <BooleanField
            key={key}
            id={`persona-${key}`}
            labelId={labelId}
            value={Boolean(personaStore.persona[key])}
            onChange={(v) => setPersonaFlag(key, v)}
          />
        ))}
      </fieldset>

      <AccountSection />
    </section>
  );
}

function ProfileSection({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intl = useIntl();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await meApi.updateName(name);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" }),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset>
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
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <button type="submit" disabled={saving || name === currentName}>
          <FormattedMessage
            id={saving ? "settings.profile.saving" : "settings.profile.save"}
          />
        </button>
      </form>
    </fieldset>
  );
}

function AccountSection() {
  const [deleting, setDeleting] = useState(false);
  const intl = useIntl();
  const signOut = useAuthStore((s) => s.signOut);

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
    if (
      !window.confirm(
        intl.formatMessage({ id: "settings.account.deleteConfirm" }),
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await accountApi.remove();
      await signOut();
      window.location.href = "/";
    } catch {
      setDeleting(false);
    }
  }

  return (
    <fieldset>
      <legend>
        <FormattedMessage id="settings.section.account" />
      </legend>
      <div className="form-field">
        <button type="button" onClick={() => void downloadExport()}>
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
          className="btn-destructive"
        >
          <FormattedMessage
            id={
              deleting ? "settings.account.deleting" : "settings.account.delete"
            }
          />
        </button>
      </div>
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
  return (
    <fieldset>
      <legend>
        <FormattedMessage id="settings.section.persona" />
      </legend>
      <p className="help">
        <FormattedMessage id="settings.persona.localOnly" />
      </p>
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
