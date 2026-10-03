import { ref } from 'vue'

/**
 * A page full of canvases must not trap scrolling. The wheel reaches a canvas only once the
 * visitor has clicked into that stage, and goes back to the page when the pointer leaves.
 */
export function useWheelEngagement() {
  const engaged = ref(false)

  function engage(): void {
    engaged.value = true
  }

  function disengage(): void {
    engaged.value = false
  }

  /** Capture-phase wheel handler for the stage root. */
  function guardWheel(event: WheelEvent): void {
    if (engaged.value || event.ctrlKey || event.metaKey) return
    // Sideways swipes never scroll the page, so they can always pan.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    event.stopPropagation()
  }

  return { engaged, engage, disengage, guardWheel }
}
