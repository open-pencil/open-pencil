import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'

/** Whether a press outside a picker leaves it open, such as one on a gradient handle. */
export type PickerKeepOpen = (event: PointerEvent) => boolean

/**
 * Outside-dismissal handlers for a picker's `PopoverContent`: the press decides through
 * `keepOpen`. Reka reports the canvas taking focus a couple of ticks after that press, so a focus
 * move to the canvas never dismisses on its own.
 */
export function pickerOutsideHandlers(keepOpen: () => PickerKeepOpen | undefined) {
  return {
    onPointerDownOutside(event: PointerDownOutsideEvent) {
      if (keepOpen()?.(event.detail.originalEvent)) event.preventDefault()
    },
    onFocusOutside(event: FocusOutsideEvent) {
      if (keepOpen() && event.detail.originalEvent.target instanceof HTMLCanvasElement)
        event.preventDefault()
    }
  }
}
