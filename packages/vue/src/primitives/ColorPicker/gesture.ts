import { useEventListener } from '@vueuse/core'

export interface PickerGestureOptions {
  /** Ends the edit made so far as one undo step. */
  commit: () => void
  /** Puts back what the press being held has changed. */
  cancel: () => void
}

/**
 * Groups a picker's changes into undo steps as Figma desktop 126 does. A press inside the picker
 * and everything it changes until the release is one step, such as a drag over the colour area;
 * a change made with no press held there is a step of its own, such as a tab's click, a typed
 * value, or a chosen image. Escape while the press is held puts back what it changed, leaves the
 * picker open, and ends the drag: the control holding the pointer loses it, so it stops following
 * until the release, and anything it still reports is dropped.
 */
export function usePickerGesture({ commit, cancel }: PickerGestureOptions) {
  let pressed = false
  let cancelled = false
  let press: { target: Element; pointerId: number } | null = null

  /** Sliders, the colour area, and the gradient bar move only while they hold the pointer. */
  function endDrag() {
    if (!press) return
    for (let element: Element | null = press.target; element; element = element.parentElement) {
      if (!element.hasPointerCapture(press.pointerId)) continue
      element.releasePointerCapture(press.pointerId)
      return
    }
  }

  function release() {
    if (!pressed) return
    pressed = false
    press = null
    if (!cancelled) commit()
    cancelled = false
  }

  useEventListener(window, ['pointerup', 'pointercancel', 'blur'], release)
  // Ahead of the popover's own Escape, which would close the picker, as the canvas does for its
  // drags (`useCanvasInput`).
  useEventListener(
    window,
    'keydown',
    (event: KeyboardEvent) => {
      if (!pressed || cancelled || event.code !== 'Escape' || event.isComposing) return
      event.preventDefault()
      event.stopImmediatePropagation()
      cancelled = true
      endDrag()
      cancel()
    },
    { capture: true }
  )

  return {
    /**
     * For the picker content's `pointerdown` in the capture phase, ahead of controls such as a
     * slider that change on the press itself: a press starts a step.
     */
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      pressed = true
      cancelled = false
      press =
        event.target instanceof Element
          ? { target: event.target, pointerId: event.pointerId }
          : null
    },
    /** Applies a change, unless Escape put its press back; with no press held it is a step. */
    change(apply: () => void) {
      if (cancelled) return
      apply()
      if (!pressed) commit()
    },
    /** For a picker closing on its own, such as a panel being put away: drops a held press. */
    abort() {
      if (pressed && !cancelled) cancel()
      pressed = false
      cancelled = false
      press = null
    }
  }
}
