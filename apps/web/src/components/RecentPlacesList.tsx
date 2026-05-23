import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";
import { useSaveLocation } from "../hooks/useSavedLocations";
import {
  useClearRecentPlaces,
  useDeleteRecentPlace,
  useRecentPlaces,
} from "../hooks/useRecentPlaces";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "./ConfirmDialog";
import { useUndoableDelete } from "../hooks/useUndoableDelete";

const SAVE_PROMPT_THRESHOLD = 3;

const CLEAR_ALL_ID = "ALL";

export function RecentPlacesList() {
  const { data, isLoading } = useRecentPlaces();
  const saveLocation = useSaveLocation();
  const deletePlace = useDeleteRecentPlace();
  const clearAll = useClearRecentPlaces();
  const intl = useIntl();
  const { confirm, dialogProps } = useConfirm();
  const { softDelete, pendingIds } = useUndoableDelete<string>();

  if (isLoading) return null;
  const allPlaces = data?.data ?? [];
  const isClearing = pendingIds.has(CLEAR_ALL_ID);
  const places = isClearing
    ? []
    : allPlaces.filter((p) => !pendingIds.has(p.id));

  // Use the underlying list to gate the empty state, so a soft-delete
  // doesn't flash empty during the undo window.
  if (allPlaces.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__art" aria-hidden="true" />
        <p>
          <FormattedMessage id="recentPlaces.empty" />
        </p>
        <p>
          <Link to="/map">
            <FormattedMessage id="recentPlaces.emptyCta" />
          </Link>
        </p>
      </div>
    );
  }

  function softRemove(p: (typeof allPlaces)[number]) {
    softDelete({
      id: p.id,
      message: intl.formatMessage(
        { id: "recentPlaces.removedToast" },
        { name: p.displayName },
      ),
      commit: () => deletePlace.mutateAsync(p.id),
    });
  }

  async function clearAllWithConfirm() {
    const ok = await confirm({
      title: intl.formatMessage({ id: "recentPlaces.clearConfirm" }),
      destructive: true,
    });
    if (!ok) return;
    softDelete({
      id: CLEAR_ALL_ID,
      message: intl.formatMessage({ id: "recentPlaces.clearedToast" }),
      commit: () => clearAll.mutateAsync(),
    });
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
                  className="btn btn--secondary btn--sm"
                >
                  <FormattedMessage id="recentPlaces.save" />
                </button>
                <button
                  type="button"
                  onClick={() => softRemove(p)}
                  aria-label={intl.formatMessage({ id: "recentPlaces.remove" })}
                  className="btn btn--ghost btn--sm"
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
          onClick={clearAllWithConfirm}
          className="btn btn--link"
        >
          <FormattedMessage id="recentPlaces.clear" />
        </button>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
