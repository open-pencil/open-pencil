import { useEventListener } from '@vueuse/core'

export interface PickerGestureOptions {
  /** Whether the picker is open; only then does a press inside it start a step. */
  open: () => boolean
  /** Ends the edit made so far as one undo step. */
  commit: () => void
  /** Puts back what the press being held has changed. */
  cancel: () => void
  /** A press inside the picker has started a step, before anything it changes. */
  start?: () => void
}

/** Every picker surface carries this, including one opened from inside another picker. */
const PICKER_CONTENT = '[data-picker-content]'

/**
 * Groups a picker's changes into undo steps as Figma desktop 126 does. A press inside the picker
 * and everything it changes until the release is one step, such as a drag over the colour area;
 * a change made with no press held is a step of its own, such as a tab's click, a typed value, or
 * a chosen image. A press counts in the picker or in one opened from it, such as a shader colour's.
 * Escape while a press that changed something is held puts that back, leaves the picker open, and
 * ends the drag: the control holding the pointer loses it, so it stops following until the
 * release, and anything it still reports is dropped.
 */
export function usePickerGesture({ open, commit, cancel, start }: PickerGestureOptions) {
  let press: { target: Element; pointerId: number } | null = null
  let changed = false
  let cancelled = false
  /** The Escape that put a press back, whose key repeats must not close the picker. */
  let escapeHeld = false

  function reset() {
    press = null
    changed = false
    cancelled = false
  }

  function release() {
    if (!press) return
    const step = changed && !cancelled
    reset()
    if (step) commit()
  }

  /** Sliders, the colour area, and the gradient bar move only while they hold the pointer. */
  function endDrag(held: { target: Element; pointerId: number }) {
    for (let element: Element | null = held.target; element; element = element.parentElement) {
      if (!element.hasPointerCapture(held.pointerId)) continue
      element.releasePointerCapture(held.pointerId)
      return
    }
  }

  // Captured on the window, ahead of controls such as a slider that change on the press itself.
  useEventListener(
    'pointerdown',
    (event: PointerEvent) => {
      if (press || event.button !== 0 || !open()) return
      if (!(event.target instanceof Element) || !event.target.closest(PICKER_CONTENT)) return
      press = { target: event.target, pointerId: event.pointerId }
      changed = false
      cancelled = false
      start?.()
    },
    { capture: true }
  )
  useEventListener(['pointerup', 'pointercancel'], (event: PointerEvent) => {
    if (press?.pointerId === event.pointerId) release()
  })
  useEventListener('blur', release)
  // Ahead of the popover's own Escape, which would close the picker, as the canvas does for its
  // drags (`useCanvasInput`).
  useEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.isComposing) return
      const held = press
      const putBack = held !== null && changed && !cancelled
      if (!putBack && !(escapeHeld && event.repeat)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!held || !putBack) return
      cancelled = true
      escapeHeld = true
      endDrag(held)
      cancel()
    },
    { capture: true }
  )
  useEventListener('keyup', (event: KeyboardEvent) => {
    if (event.code === 'Escape') escapeHeld = false
  })

  return {
    /** Applies a change, unless Escape put its press back; with no press held it is a step. */
    change(apply: () => void) {
      if (cancelled) return
      apply()
      if (press) changed = true
      else commit()
    },
    /**
     * Applies a change that is a step of its own whatever press is held, such as an image that
     * arrives once its file is read. What a held press changed so far becomes its own step first.
     */
    step(apply: () => void) {
      if (press && changed && !cancelled) {
        commit()
        changed = false
      }
      apply()
      commit()
    },
    /** For the picker closing while a press is held, such as when it loses focus: drops it. */
    abort() {
      const putBack = press !== null && changed && !cancelled
      reset()
      if (putBack) cancel()
    }
  }
}
