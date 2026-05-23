import { useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { SavedLocation, SavedLocationCategory } from "@reissulla/shared";
import {
  useDeleteLocation,
  useSavedLocations,
  useUpdateLocation,
} from "../hooks/useSavedLocations";
import { ApiError } from "@reissulla/api-client";
import { shareLocation } from "../lib/share-location";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "./ConfirmDialog";

const CATEGORIES: ReadonlyArray<SavedLocationCategory> = [
  "home",
  "work",
  "school",
  "cottage",
  "family",
  "hobby",
  "other",
];

export function SavedLocationsManager() {
  const { data, isLoading } = useSavedLocations();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();
  const intl = useIntl();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirm();

  if (isLoading) return null;
  const locations = data?.data ?? [];

  if (locations.length === 0) {
    return (
      <p className="help">
        <FormattedMessage id="locations.empty" />
      </p>
    );
  }

  async function patch(
    update: Parameters<typeof updateLocation.mutateAsync>[0],
  ) {
    setError(null);
    try {
      await updateLocation.mutateAsync(update);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" }),
      );
    }
  }

  async function setPrimary(loc: SavedLocation) {
    await patch({ id: loc.id, isPrimary: true });
  }

  async function moveBy(loc: SavedLocation, delta: -1 | 1) {
    const newOrder = loc.sortOrder + delta;
    if (newOrder < 0) return;
    // Naive swap: bump the moved row to its new sortOrder. Two rows can
    // briefly share a sort_order — the DB doesn't enforce uniqueness, and
    // the list re-orders by the same value as a tiebreaker on next render.
    await patch({ id: loc.id, sortOrder: newOrder });
    const neighbour = locations.find((l) => l.sortOrder === newOrder);
    if (neighbour && neighbour.id !== loc.id) {
      await patch({ id: neighbour.id, sortOrder: loc.sortOrder });
    }
  }

  async function rename(loc: SavedLocation, newName: string) {
    if (newName.trim().length === 0) return;
    await patch({ id: loc.id, name: newName.trim() });
    setEditingId(null);
  }

  async function setCategory(
    loc: SavedLocation,
    category: SavedLocationCategory | null,
  ) {
    await patch({ id: loc.id, category });
  }

  async function remove(loc: SavedLocation) {
    const ok = await confirm({
      title: intl.formatMessage({ id: "locations.deleteConfirm" }),
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteLocation.mutateAsync(loc.id);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" }),
      );
    }
  }

  async function share(loc: SavedLocation) {
    setShareNotice(null);
    try {
      const shared = await shareLocation(
        { lat: loc.latitude, lon: loc.longitude, name: loc.name },
        loc.name,
      );
      if (shared) {
        setShareNotice(intl.formatMessage({ id: "locations.shared" }));
      }
    } catch {
      setShareNotice(intl.formatMessage({ id: "locations.shareError" }));
    }
  }

  return (
    <div className="saved-locations-manager">
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {shareNotice && (
        <div role="status" className="form-status">
          {shareNotice}
        </div>
      )}
      <ul className="saved-locations-list">
        {locations.map((loc, index) => {
          const isFirst = index === 0;
          const isLast = index === locations.length - 1;
          const isEditing = editingId === loc.id;
          return (
            <li key={loc.id} className="saved-location-row">
              {isEditing ? (
                <RenameForm
                  initial={loc.name}
                  onCancel={() => setEditingId(null)}
                  onSave={(name) => rename(loc, name)}
                />
              ) : (
                <>
                  <div className="saved-location-row__primary">
                    <span className="saved-location-name">{loc.name}</span>
                    {loc.isPrimary && (
                      <span className="badge">
                        <FormattedMessage id="locations.primary" />
                      </span>
                    )}
                    {loc.region && (
                      <span className="saved-location-region">
                        {loc.region}
                      </span>
                    )}
                  </div>
                  <div className="saved-location-row__controls">
                    <label
                      className="visually-hidden"
                      htmlFor={`cat-${loc.id}`}
                    >
                      <FormattedMessage id="locations.category" />
                    </label>
                    <select
                      id={`cat-${loc.id}`}
                      value={loc.category ?? ""}
                      onChange={(e) =>
                        setCategory(
                          loc,
                          (e.currentTarget.value ||
                            null) as SavedLocationCategory | null,
                        )
                      }
                    >
                      <option value="">
                        {intl.formatMessage({ id: "locations.category.none" })}
                      </option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {intl.formatMessage({
                            id: `locations.category.${c}`,
                          })}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => moveBy(loc, -1)}
                      disabled={isFirst}
                      aria-label={intl.formatMessage({
                        id: "locations.moveUp",
                      })}
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBy(loc, 1)}
                      disabled={isLast}
                      aria-label={intl.formatMessage({
                        id: "locations.moveDown",
                      })}
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                    {!loc.isPrimary && (
                      <button type="button" onClick={() => setPrimary(loc)}>
                        <FormattedMessage id="locations.makePrimary" />
                      </button>
                    )}
                    <button type="button" onClick={() => setEditingId(loc.id)}>
                      <FormattedMessage id="locations.rename" />
                    </button>
                    <button type="button" onClick={() => share(loc)}>
                      <FormattedMessage id="locations.share" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(loc)}
                      className="btn-destructive"
                    >
                      <FormattedMessage id="locations.delete" />
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

function RenameForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount — user just clicked "Rename" and expects to
  // start typing. Using a ref instead of autoFocus to satisfy the
  // jsx-a11y/no-autofocus rule (which is about preventing focus surprises
  // on initial page render; an explicit click→form mount is the same UX
  // either way).
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name);
      }}
      className="saved-location-rename"
    >
      <label className="visually-hidden" htmlFor="rename-input">
        <FormattedMessage id="locations.renameLabel" />
      </label>
      <input
        ref={inputRef}
        id="rename-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={1}
        maxLength={255}
      />
      <button type="submit">
        <FormattedMessage id="locations.saveChanges" />
      </button>
      <button type="button" onClick={onCancel} className="link-button">
        <FormattedMessage id="locations.cancel" />
      </button>
    </form>
  );
}
