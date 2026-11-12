import type { OpenOverlays } from '#vue/lifecycle/overlays'

// A key pressed inside a dialog, menu, list, or picker is that widget's own, such as an arrow in
// an inline list that never opened as an overlay. One already closing is not: Reka keeps it, and
// the focus in it, until its exit animation ends, and a key pressed then belongs to the canvas.
const ANY_OVERLAY_SELECTOR =
  ':is([data-picker-content], [role="dialog"], [role="listbox"], [role="menu"])'
const OVERLAY_SELECTOR = `${ANY_OVERLAY_SELECTOR}:not([data-state="closed"])`
const CLOSING_OVERLAY_SELECTOR = `${ANY_OVERLAY_SELECTOR}[data-state="closed"]`
const PICKER_SELECTOR = '[data-picker-content]'

/**
 * Whether the key was pressed in a dialog, menu, list, or picker that is closing. Its items still
 * answer keys, as a menu item Enter clicks, so a key the canvas took must stop short of them.
 */
export function pressedInClosingOverlay(event: KeyboardEvent): boolean {
  return event
    .composedPath()
    .some((target) => target instanceof Element && target.matches(CLOSING_OVERLAY_SELECTOR))
}

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
