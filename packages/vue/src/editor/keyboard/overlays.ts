import type { OpenOverlays } from '#vue/lifecycle/overlays'

// A key pressed inside a dialog, menu, list, or picker is that widget's own, such as an arrow in
// an inline list that never opened as an overlay.
const OVERLAY_SELECTOR = '[data-picker-content], [role="dialog"], [role="listbox"], [role="menu"]'
const PICKER_SELECTOR = '[data-picker-content]'

function pressedInOverlay(event: KeyboardEvent, allowPickers: boolean) {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target.matches(OVERLAY_SELECTOR) &&
        !(allowPickers && target.closest(PICKER_SELECTOR))
    )
}

/**
 * Whether an open dialog, menu, list, or picker holds the canvas's keys back, shortcuts and
 * nudging alike: one registered as open (`useOverlayOpen`), or the one the key was pressed in.
 * The shortcut listener captures on the window, so it runs before an overlay's own handlers and
 * sees an overlay still open even when its Escape is about to close it.
 * `history` asks about undo and redo, which a picker leaves to the document.
 */
export function overlayHoldsKeys(
  event: KeyboardEvent,
  overlays: OpenOverlays | undefined,
  history = false
): boolean {
  return !!overlays?.holdsKeys(history) || pressedInOverlay(event, history)
}
