import { ref } from 'vue'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** How far, in screen pixels, a press moves before it drags the pin instead of clicking it. */
const PIN_DRAG_THRESHOLD = 3

interface PinDrag {
  id: string
  startX: number
  startY: number
  origin: Vector
  at: Vector
  moved: boolean
}

/**
 * Dragging comment pins, as in Figma: a press that moves a few pixels drags the pin in canvas
 * units, and dropping it calls `onDrop`; a shorter press is a click, which calls `onClick`.
 */
export function usePinDrag(options: {
  zoom: () => number
  onDrop: (threadId: string, at: Vector) => void
  onClick: (threadId: string) => void
}) {
  const drag = ref<PinDrag | null>(null)
  // The click that ends a drag only drops the pin; browsers differ on whether it comes at all.
  let dropped = false

  function start(event: PointerEvent, threadId: string, origin: Vector) {
    if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dropped = false
    drag.value = {
      id: threadId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      at: origin,
      moved: false
    }
  }

  function move(event: PointerEvent) {
    const current = drag.value
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.moved && Math.hypot(dx, dy) < PIN_DRAG_THRESHOLD) return
    const zoom = options.zoom()
    current.moved = true
    current.at = { x: current.origin.x + dx / zoom, y: current.origin.y + dy / zoom }
  }

  function end() {
    const current = drag.value
    drag.value = null
    if (!current?.moved) return
    dropped = true
    options.onDrop(current.id, current.at)
  }

  function click(threadId: string) {
    if (dropped) {
      dropped = false
      return
    }
    options.onClick(threadId)
  }

  /** Where a pin being dragged is now, or null when it is not the one moving. */
  function draggedTo(threadId: string): Vector | null {
    const current = drag.value
    return current?.id === threadId && current.moved ? current.at : null
  }

  return { start, move, end, click, draggedTo }
}
