import { useEventListener, useTimeoutFn } from '@vueuse/core'

export interface PickerGestureOptions {
  /** Whether the picker is open; only then does a press inside it start a step. */
  open: () => boolean
  /** Ends the edit made so far as one undo step. */
  commit: () => void
  /** Puts back what the press being held has changed. */
  cancel: () => void
  /** A held press is about to make its first change, such as the moment to note what it changes. */
  beforeChange?: () => void
}

/**
 * Why a picker reports `cancel`: `press` when Escape, or the picker closing, put back a press's
 * change; `escape` when Escape closed a picker that puts back the colour it opened with.
 */
export type PickerCancelCause = 'press' | 'escape'

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
export function usePickerGesture({ open, commit, cancel, beforeChange }: PickerGestureOptions) {
  let press: { target: Element; pointerId: number } | null = null
  let changed = false
  let cancelled = false
  /** The Escape that put a press back, whose key repeats must not close the picker. */
  let escapeHeld = false
  /** Steps of their own that arrived while a press was held, applied once it ends. */
  let waiting: Array<() => void> = []

  function applyWaiting() {
    const steps = waiting
    waiting = []
    for (const apply of steps) {
      apply()
      commit()
    }
  }

  function end(): boolean {
    const step = changed && !cancelled
    press = null
    changed = false
    cancelled = false
    return step
  }

  function release() {
    releaseLater.stop()
    if (!press) return
    if (end()) commit()
    applyWaiting()
  }

  // A control that stops its release from bubbling still ends the press, once its own handler
  // has made its last change.
  const releaseLater = useTimeoutFn(release, 0, { immediate: false })

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
    },
    { capture: true }
  )
  useEventListener(
    ['pointerup', 'pointercancel'],
    (event: PointerEvent) => {
      if (press?.pointerId === event.pointerId) releaseLater.start()
    },
    { capture: true }
  )
  useEventListener(['pointerup', 'pointercancel'], (event: PointerEvent) => {
    if (press?.pointerId === event.pointerId) release()
  })
  useEventListener('blur', release)
  // Ahead of the popover's own Escape, which would close the picker, as the canvas does for its
  // drags (`useCanvasInput`). Propagation stops, but a picker opened from this one still sees the
  // key and puts back the same press.
  useEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.isComposing) return
      const held = press
      const putBack = held !== null && changed && !cancelled
      if (!putBack && !(escapeHeld && event.repeat)) return
      event.preventDefault()
      event.stopPropagation()
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
      if (press && !changed) beforeChange?.()
      apply()
      if (press) changed = true
      else commit()
    },
    /**
     * Applies a change that is a step of its own, such as an image that arrives once its file is
     * read. While a press is held, even one Escape put back, it waits for the press to end, so it
     * neither splits that step nor survives being put back with it, and steps keep their order.
     */
    step(apply: () => void) {
      if (press) {
        waiting.push(apply)
        return
      }
      apply()
      commit()
    },
    /** For the picker closing while a press is held, such as when it loses focus: drops it. */
    abort() {
      releaseLater.stop()
      const putBack = press !== null && changed && !cancelled
      end()
      if (putBack) cancel()
      applyWaiting()
    }
  }
}
