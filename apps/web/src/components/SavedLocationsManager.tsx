import { useEffect, useRef, useState, type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { SavedLocation, SavedLocationCategory } from "@reissulla/shared";
import {
  useDeleteLocation,
  useSavedLocations,
  useUpdateLocation,
} from "../hooks/useSavedLocations";
import { ApiError } from "@reissulla/api-client";
import { Link } from "react-router";
import { shareLocation } from "../lib/share-location";
import { useConfirm } from "../hooks/useConfirm";
import { ConfirmDialog } from "./ConfirmDialog";
import { showToast } from "../stores/toast";
import { useUndoableDelete } from "../hooks/useUndoableDelete";
import { FoldedMapArt } from "./art/EmptyArt";
import { usePersonaStore } from "../stores/persona";

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
  const { confirm, dialogProps } = useConfirm();
  const { softDelete, pendingIds } = useUndoableDelete<string>();

  if (isLoading) return null;
  const allLocations = data?.data ?? [];
  const locations = allLocations.filter((l) => !pendingIds.has(l.id));

  // Use the underlying (unfiltered) list to decide between empty
  // state vs row list — otherwise a soft-delete that empties the
  // visible list would flash the empty state during the 5s undo
  // window.
  if (allLocations.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__art" aria-hidden="true">
          <FoldedMapArt />
        </div>
        <p className="empty-state__phrase">
          <FormattedMessage id="locations.empty" />
        </p>
        <p>
          <Link to="/map">
            <FormattedMessage id="locations.emptyCta" />
          </Link>
        </p>
      </div>
    );
  }

  async function patch(
    update: Parameters<typeof updateLocation.mutateAsync>[0],
  ) {
    try {
      await updateLocation.mutateAsync(update);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: "settings.saveError" });
      showToast({ message, kind: "error" });
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
    softDelete({
      id: loc.id,
      message: intl.formatMessage(
        { id: "locations.deletedToast" },
        { name: loc.name },
      ),
      commit: async () => {
        try {
          await deleteLocation.mutateAsync(loc.id);
        } catch (err) {
          const message =
            err instanceof ApiError
              ? err.message
              : intl.formatMessage({ id: "settings.saveError" });
          showToast({ message, kind: "error" });
        }
      },
    });
  }

  async function share(loc: SavedLocation) {
    try {
      const shared = await shareLocation(
        { lat: loc.latitude, lon: loc.longitude, name: loc.name },
        loc.name,
      );
      if (shared) {
        showToast({
          message: intl.formatMessage({ id: "locations.shared" }),
          kind: "success",
        });
      }
    } catch {
      showToast({
        message: intl.formatMessage({ id: "locations.shareError" }),
        kind: "error",
      });
    }
  }

  return (
    <div className="saved-locations-manager">
      <SavedLocationsPersonaSummary />
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
                    {/* The row's secondary controls. We render the same
                        buttons twice — once for desktop (visible inline)
                        and once for mobile (hidden inside a kebab
                        <details>). CSS shows whichever fits the viewport.
                        Older single-DOM <details> + display:contents
                        approach lost the buttons at desktop widths
                        because the closed <details> hides non-summary
                        children before display:contents can hoist them. */}
                    {(() => {
                      const actionButtons = (
                        <>
                          <button
                            type="button"
                            onClick={() => moveBy(loc, -1)}
                            disabled={isFirst}
                            aria-label={intl.formatMessage({
                              id: "locations.moveUp",
                            })}
                            className="btn btn--ghost btn--sm"
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
                            className="btn btn--ghost btn--sm"
                          >
                            <span aria-hidden="true">↓</span>
                          </button>
                          {!loc.isPrimary && (
                            <button
                              type="button"
                              onClick={() => setPrimary(loc)}
                              className="btn btn--secondary btn--sm"
                            >
                              <FormattedMessage id="locations.makePrimary" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingId(loc.id)}
                            className="btn btn--secondary btn--sm"
                          >
                            <FormattedMessage id="locations.rename" />
                          </button>
                          <button
                            type="button"
                            onClick={() => share(loc)}
                            className="btn btn--secondary btn--sm"
                          >
                            <FormattedMessage id="locations.share" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(loc)}
                            className="btn btn--destructive btn--sm"
                          >
                            <FormattedMessage id="locations.delete" />
                          </button>
                        </>
                      );
                      return (
                        <>
                          <div className="row-actions-desktop">
                            {actionButtons}
                          </div>
                          <RowActionsMobile
                            rowLabel={intl.formatMessage(
                              { id: "savedLocations.rowActionsLabel" },
                              { name: loc.name },
                            )}
                          >
                            {actionButtons}
                          </RowActionsMobile>
                        </>
                      );
                    })()}
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

/**
 * Mobile-only kebab popover for row-secondary buttons. The companion
 * `.row-actions-desktop` div (inline siblings of this component in
 * the markup above) carries the same buttons for ≥40rem viewports;
 * CSS hides whichever subtree doesn't apply.
 *
 * `<details>` doesn't auto-wire `aria-expanded`, so the effect below
 * mirrors `open` onto `aria-expanded` on the summary — gives SR users
 * a proper announcement of menu state without competing with the
 * default disclosure behaviour.
 */
function RowActionsMobile({
  rowLabel,
  children,
}: {
  rowLabel: string;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    const summary = summaryRef.current;
    if (!details || !summary) return;
    const sync = () => {
      summary.setAttribute("aria-expanded", details.open ? "true" : "false");
    };
    sync();
    details.addEventListener("toggle", sync);
    return () => details.removeEventListener("toggle", sync);
  }, []);

  return (
    <details ref={detailsRef} className="row-actions-mobile">
      <summary
        ref={summaryRef as React.RefObject<HTMLElement>}
        className="row-actions-mobile__summary"
        aria-label={rowLabel}
      >
        <span aria-hidden="true">⋯</span>
      </summary>
      <div className="row-actions-mobile__items">{children}</div>
    </details>
  );
}

/**
 * A11Y-17 reinforcement — when the user has any accessibility flag set in
 * their persona, surface it inline at the top of the saved-locations list.
 * The persona is global (one profile per user) but it shapes the route
 * suggestions for every saved location, so a small reminder here keeps
 * the connection visible without forcing the user back to Settings to
 * remember what's on.
 */
function SavedLocationsPersonaSummary() {
  const intl = useIntl();
  const persona = usePersonaStore((s) => s.persona);
  const flags: string[] = [];
  if (persona.wheelchair) flags.push("wheelchair");
  if (persona.lowFloor) flags.push("lowFloor");
  if (persona.noStairs) flags.push("noStairs");
  if (persona.stroller) flags.push("stroller");
  if (flags.length === 0) return null;
  return (
    <aside
      className="saved-locations-persona"
      aria-label={intl.formatMessage({ id: "locations.persona.label" })}
    >
      <p className="saved-locations-persona__kicker">
        <FormattedMessage id="locations.persona.kicker" />
      </p>
      <p className="saved-locations-persona__body">
        <FormattedMessage id="locations.persona.body" />
      </p>
      <ul className="saved-locations-persona__flags">
        {flags.map((flag) => (
          <li key={flag} className="saved-locations-persona__flag">
            <FormattedMessage id={`settings.persona.${flag}`} />
          </li>
        ))}
      </ul>
      <p className="saved-locations-persona__manage">
        <Link to="/settings">
          <FormattedMessage id="locations.persona.manage" />
        </Link>
      </p>
    </aside>
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
      <button type="submit" className="btn btn--primary btn--sm">
        <FormattedMessage id="locations.saveChanges" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="btn btn--ghost btn--sm"
      >
        <FormattedMessage id="locations.cancel" />
      </button>
    </form>
  );
}
