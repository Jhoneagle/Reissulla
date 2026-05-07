import { useSaveLocation, useDeleteLocation } from "../hooks/useSavedLocations";
import { useAuthStore } from "../stores/auth";

interface SaveToggleButtonProps {
  savedId: string | null;
  lat: number;
  lon: number;
  name: string;
}

export function SaveToggleButton({
  savedId,
  lat,
  lon,
  name,
}: SaveToggleButtonProps) {
  const user = useAuthStore((s) => s.user);
  const saveLocation = useSaveLocation();
  const deleteLocation = useDeleteLocation();

  if (!user) return null;

  const isPending = saveLocation.isPending || deleteLocation.isPending;

  // Derive visual state from both the prop AND mutation status to avoid
  // the flash between mutation-complete and query-refetch-complete.
  const visuallySaved = savedId
    ? !deleteLocation.isSuccess // saved, unless we just deleted it
    : saveLocation.isSuccess; // not saved, unless we just saved it

  const handleClick = () => {
    // Reset the opposite mutation so stale isSuccess doesn't interfere
    if (savedId) {
      saveLocation.reset();
      deleteLocation.mutate(savedId);
    } else {
      deleteLocation.reset();
      saveLocation.mutate({ name, latitude: lat, longitude: lon });
    }
  };

  const hasError = saveLocation.isError || deleteLocation.isError;

  return (
    <button
      type="button"
      className={`save-toggle${visuallySaved ? " save-toggle--saved" : ""}${isPending ? " save-toggle--pending" : ""}${hasError ? " save-toggle--error" : ""}`}
      onClick={handleClick}
      disabled={isPending}
      aria-label={
        hasError
          ? "Failed to save — try again"
          : visuallySaved
            ? "Remove from saved locations"
            : "Save location"
      }
      aria-pressed={visuallySaved}
      title={hasError ? "Failed to save — try again" : undefined}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={visuallySaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
