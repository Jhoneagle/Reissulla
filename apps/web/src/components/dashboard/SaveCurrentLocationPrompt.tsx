import { useState, type FormEvent } from "react";
import { FormattedMessage } from "react-intl";
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
      {/* Always-visible guidance — placeholder-as-guidance disappears
          on type, which leaves SR users without a hint and sighted
          users without context after they start. */}
      <p id="save-current-name-help" className="help">
        <FormattedMessage id="dashboard.savePromptHelp" />
      </p>
      <input
        id="save-current-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        minLength={1}
        maxLength={255}
        aria-describedby="save-current-name-help"
      />
      <button
        type="submit"
        disabled={saveLocation.isPending || !name.trim()}
        className="btn btn--primary"
      >
        <FormattedMessage
          id={saveLocation.isPending ? "dashboard.saving" : "recentPlaces.save"}
        />
      </button>
    </form>
  );
}
