function isEditableTarget(target: EventTarget | null | undefined): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function isButtonActivation(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false
  if (event.code !== 'Enter' && event.code !== 'Space') return false
  return event.composedPath().some((target) => target instanceof HTMLButtonElement)
}

export function isEditing(event: Event) {
  return event.composedPath().some(isEditableTarget)
}

const OVERLAY_SELECTOR = '[data-picker-content], [role="dialog"], [role="listbox"], [role="menu"]'
const PICKER_SELECTOR = '[data-picker-content]'
const OPEN_LAYER_SELECTOR = '[data-dismissable-layer]:not([data-state="closed"])'

export function originatedInOverlay(event: KeyboardEvent, allowPickers = false) {
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
export function hasOpenDismissableLayer(allowPickers = false) {
  return [...document.querySelectorAll(OPEN_LAYER_SELECTOR)].some(
    (layer) => !(allowPickers && layer.closest(PICKER_SELECTOR))
  )
}

export function hasDocumentTextSelection(): boolean {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed && selection.toString().length > 0
}

export function isInputElement(element: EventTarget | null | undefined): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}
