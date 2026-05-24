import { FormattedMessage, useIntl } from "react-intl";
import { useSaveLocation } from "../hooks/useSavedLocations";
import {
  useClearRecentPlaces,
  useDeleteRecentPlace,
  useRecentPlaces,
} from "../hooks/useRecentPlaces";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "./ConfirmDialog";

const SAVE_PROMPT_THRESHOLD = 3;

export function RecentPlacesList() {
  const { data, isLoading } = useRecentPlaces();
  const saveLocation = useSaveLocation();
  const deletePlace = useDeleteRecentPlace();
  const clearAll = useClearRecentPlaces();
  const intl = useIntl();
  const { confirm, dialogProps } = useConfirm();

  if (isLoading) return null;
  const places = data?.data ?? [];

  if (places.length === 0) {
    return (
      <p className="help">
        <FormattedMessage id="recentPlaces.empty" />
      </p>
    );
  }

  return (
    <div className="recent-places-list">
      <ul>
        {places.map((p) => {
          const showSavePrompt = p.visitCount >= SAVE_PROMPT_THRESHOLD;
          return (
            <li key={p.id} className="recent-place-row">
              <div className="recent-place-row__primary">
                <span className="recent-place-name">{p.displayName}</span>
                <span className="recent-place-visits">
                  <FormattedMessage
                    id="recentPlaces.visitCount"
                    values={{ count: p.visitCount }}
                  />
                </span>
              </div>
              {showSavePrompt && (
                <p role="status" className="recent-place-prompt">
                  <FormattedMessage id="recentPlaces.savePrompt" />
                </p>
              )}
              <div className="recent-place-row__controls">
                <button
                  type="button"
                  onClick={() =>
                    saveLocation.mutate({
                      name: p.displayName,
                      latitude: p.latitude,
                      longitude: p.longitude,
                    })
                  }
                  disabled={saveLocation.isPending}
                >
                  <FormattedMessage id="recentPlaces.save" />
                </button>
                <button
                  type="button"
                  onClick={() => deletePlace.mutate(p.id)}
                  aria-label={intl.formatMessage({ id: "recentPlaces.remove" })}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="recent-places-actions">
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: intl.formatMessage({ id: "recentPlaces.clearConfirm" }),
              destructive: true,
            });
            if (ok) clearAll.mutate();
          }}
          className="link-button"
        >
          <FormattedMessage id="recentPlaces.clear" />
        </button>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
