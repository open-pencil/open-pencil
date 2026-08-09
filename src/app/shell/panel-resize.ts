import { readonly, ref } from 'vue'

/**
 * Whether the user is currently dragging a panel divider.
 *
 * Driven by the drag itself — pointer down on a divider, pointer up anywhere — rather than
 * inferred from a timer after the last resize. The canvas hides its selection chrome while
 * this holds, because the overlay layer only rebuilds once the drag ends and would
 * otherwise draw handles around a canvas that no longer exists.
 */
const dragging = ref(false)

export function usePanelResizing() {
  return readonly(dragging)
}

export function beginPanelResize(): void {
  dragging.value = true
}

export function endPanelResize(): void {
  dragging.value = false
}
