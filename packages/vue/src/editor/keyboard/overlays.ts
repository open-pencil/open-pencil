import type { OpenOverlays } from '#vue/lifecycle/overlays'

// Fallback for overlays that do not register through `useOverlayOpen` yet: menus, popovers, and
// context menus built on Reka's roots directly. Remove once they all go through shared wrappers.
const OVERLAY_SELECTOR = '[data-picker-content], [role="dialog"], [role="listbox"], [role="menu"]'
const PICKER_SELECTOR = '[data-picker-content]'
const OPEN_LAYER_SELECTOR = '[data-dismissable-layer]:not([data-state="closed"])'

function originatedInOverlay(event: KeyboardEvent, allowPickers: boolean) {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target.matches(OVERLAY_SELECTOR) &&
        !(allowPickers && target.closest(PICKER_SELECTOR))
    )
}

/** A popover, menu, or dialog that is open; one fading out after closing no longer counts. */
function hasOpenDismissableLayer(allowPickers: boolean) {
  return [...document.querySelectorAll(OPEN_LAYER_SELECTOR)].some(
    (layer) => !(allowPickers && layer.closest(PICKER_SELECTOR))
  )
}

/**
 * Whether an open dialog, menu, list, or picker holds the canvas's keys back, shortcuts and
 * nudging alike; `history` asks about undo and redo, which a picker leaves to the document.
 */
export function overlayHoldsKeys(
  event: KeyboardEvent,
  overlays: OpenOverlays | undefined,
  history = false
): boolean {
  return (
    !!overlays?.holdsKeys(history) ||
    hasOpenDismissableLayer(history) ||
    originatedInOverlay(event, history)
  )
}
