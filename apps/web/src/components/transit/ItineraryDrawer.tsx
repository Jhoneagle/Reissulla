import { FormattedMessage } from "react-intl";
import type { TransitItinerary } from "@reissulla/shared";
import { Modal } from "../Modal";
import { ItineraryCard } from "./ItineraryCard";
import "./itinerary-drawer.css";

/**
 * Side-anchored drawer that replays a recorded itinerary in a read-only full
 * `<ItineraryCard>`. Used by the History page and the dashboard recent-trips
 * card. Reuses the `<Modal>` primitive (focus trap + return-to-opener) with
 * the `--drawer` CSS variant; `isOpen` is derived from a nullable itinerary so
 * the caller just sets/clears the selected trip.
 */
export function ItineraryDrawer({
  itinerary,
  onClose,
}: {
  itinerary: TransitItinerary | null;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={itinerary !== null}
      onClose={onClose}
      labelledBy="itinerary-drawer-title"
      className="modal-dialog--drawer"
    >
      <div className="itinerary-drawer">
        <header className="itinerary-drawer__header">
          <h2 id="itinerary-drawer-title" className="itinerary-drawer__title">
            <FormattedMessage id="history.drawer.title" />
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
          >
            <FormattedMessage id="history.drawer.close" />
          </button>
        </header>
        {itinerary && <ItineraryCard itinerary={itinerary} index={0} />}
      </div>
    </Modal>
  );
}
