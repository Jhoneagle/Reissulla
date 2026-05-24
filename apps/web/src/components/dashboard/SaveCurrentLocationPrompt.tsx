import { useState, type FormEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useAuthStore } from "../../stores/auth";
import { useSaveLocation } from "../../hooks/useSavedLocations";

interface Props {
  lat: number;
  lon: number;
}

/**
 * "Save this place" affordance shown on the anonymous dashboard card.
 * Authenticated users only — anonymous users see a sign-up nudge instead
 * (rendered by the parent).
 *
 * Roadmap DASH-8.
 */
export function SaveCurrentLocationPrompt({ lat, lon }: Props) {
  const user = useAuthStore((s) => s.user);
  const saveLocation = useSaveLocation();
  const intl = useIntl();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  if (saved) {
    return (
      <p role="status" className="dashboard-saved">
        <FormattedMessage id="dashboard.saved" />
      </p>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) return;
    await saveLocation.mutateAsync({
      name: name.trim(),
      latitude: lat,
      longitude: lon,
    });
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="dashboard-save-prompt">
      <label htmlFor="save-current-name">
        <FormattedMessage id="dashboard.savePromptHere" />
      </label>
      <input
        id="save-current-name"
        type="text"
        placeholder={intl.formatMessage({ id: "dashboard.savePromptName" })}
        value={name}
        onChange={(e) => setName(e.target.value)}
        minLength={1}
        maxLength={255}
      />
      <button type="submit" disabled={saveLocation.isPending || !name.trim()}>
        <FormattedMessage
          id={saveLocation.isPending ? "dashboard.saving" : "recentPlaces.save"}
        />
      </button>
    </form>
  );
}
