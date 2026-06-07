import { useId, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import type { LayerId } from "@reissulla/shared";
import { Modal } from "../Modal";
import { useMapStore } from "../../stores/map";
import { showToast } from "../../stores/toast";
import { useLayerPrefsPersist } from "../../hooks/useLayerPrefsPersist";
import "./LayerControl.css";

/**
 * Map layer picker. Trigger button (positioned by the parent) opens a
 * focus-trapped `<Modal>` with two fieldsets — base-layer radios and
 * overlay checkboxes. Native form controls drive a11y; the only extras
 * are an `aria-pressed` on the trigger and a polite toast announcement
 * on layer change.
 *
 * User-facing layers in this iteration: `tile-streets`, `tile-dark`,
 * `tile-hc` for bases and `overlay-warnings` for overlays. The other
 * registry entries are escape-hatch stubs and stay out of the UI until
 * their renderers / tile sources ship.
 */

const BASE_LAYER_OPTIONS: LayerId[] = ["tile-streets", "tile-dark", "tile-hc"];
const OVERLAY_OPTIONS: LayerId[] = ["overlay-warnings", "overlay-rain-radar"];

export function LayerControl() {
  const intl = useIntl();
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const baseLayer = useMapStore((s) => s.baseLayer);
  const overlays = useMapStore((s) => s.overlays);
  const setBaseLayer = useMapStore((s) => s.setBaseLayer);
  const toggleOverlay = useMapStore((s) => s.toggleOverlay);

  const persist = useLayerPrefsPersist();

  const layerName = (id: LayerId): string =>
    intl.formatMessage({ id: `map.layer.${id}.name` });

  const handleBaseChange = (next: LayerId) => {
    setBaseLayer(next);
    persist(next, [...useMapStore.getState().overlays]);
    showToast({
      message: intl.formatMessage(
        { id: "map.layer.toast.baseChanged" },
        { name: layerName(next) },
      ),
      kind: "info",
    });
  };

  const handleOverlayToggle = (id: LayerId) => {
    toggleOverlay(id);
    const nextOverlays = [...useMapStore.getState().overlays];
    persist(useMapStore.getState().baseLayer, nextOverlays);
    const enabled = useMapStore.getState().overlays.has(id);
    showToast({
      message: intl.formatMessage(
        {
          id: enabled
            ? "map.layer.toast.overlayOn"
            : "map.layer.toast.overlayOff",
        },
        { name: layerName(id) },
      ),
      kind: "info",
    });
  };

  return (
    <>
      <button
        type="button"
        className="layer-control__trigger"
        aria-pressed={isOpen}
        aria-haspopup="dialog"
        aria-label={intl.formatMessage({ id: "map.layer.trigger.label" })}
        onClick={() => setIsOpen(true)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span className="layer-control__trigger-label">
          <FormattedMessage id="map.layer.trigger.text" />
        </span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        labelledBy={headingId}
        className="layer-control__dialog"
      >
        <h2 id={headingId} className="layer-control__title">
          <FormattedMessage id="map.layer.dialog.title" />
        </h2>

        <fieldset className="layer-control__group">
          <legend>
            <FormattedMessage id="map.layer.section.base" />
          </legend>
          <div className="layer-control__options">
            {BASE_LAYER_OPTIONS.map((id) => (
              <label key={id} className="layer-control__option">
                <input
                  type="radio"
                  name="base-layer"
                  value={id}
                  checked={baseLayer === id}
                  onChange={() => handleBaseChange(id)}
                />
                <span>{layerName(id)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="layer-control__group">
          <legend>
            <FormattedMessage id="map.layer.section.overlays" />
          </legend>
          <div className="layer-control__options">
            {OVERLAY_OPTIONS.map((id) => (
              <label key={id} className="layer-control__option">
                <input
                  type="checkbox"
                  checked={overlays.has(id)}
                  onChange={() => handleOverlayToggle(id)}
                />
                <span>{layerName(id)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="layer-control__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setIsOpen(false)}
          >
            <FormattedMessage id="map.layer.dialog.close" />
          </button>
        </div>
      </Modal>
    </>
  );
}
