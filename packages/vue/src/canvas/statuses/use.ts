import { useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { PlacedStatusLabel } from '@open-pencil/core/canvas'

export interface CanvasStatusLabelOptions {
  /** Status label under a point in canvas-element CSS pixels; `useCanvas()` returns one. */
  hitTest: (screenX: number, screenY: number) => PlacedStatusLabel | null
  /** Called on a primary click on a label, after its layer is selected. */
  onActivate?: (label: PlacedStatusLabel) => void
}

/**
 * Makes the status pills and dots on canvas titles clickable: a click selects the layer and opens
 * its status, the way Figma's Ready for dev pill opens its menu. Listeners run in the capture phase
 * so the click never starts a selection drag or a tool.
 */
export function useCanvasStatusLabels(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options: CanvasStatusLabelOptions
) {
  const hovered = shallowRef<PlacedStatusLabel | null>(null)

  function labelAt(event: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return options.hitTest(event.clientX - rect.left, event.clientY - rect.top)
  }

  function onMouseMove(event: MouseEvent) {
    hovered.value = event.buttons === 0 ? labelAt(event) : null
    if (!hovered.value) return
    editor.setHoveredNode(hovered.value.nodeId)
    event.stopImmediatePropagation()
  }

  function onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return
    const label = labelAt(event)
    if (!label) return
    event.preventDefault()
    event.stopImmediatePropagation()
    editor.select([label.nodeId])
    options.onActivate?.(label)
  }

  useEventListener(canvasRef, 'mousemove', onMouseMove, { capture: true })
  useEventListener(canvasRef, 'mousedown', onMouseDown, { capture: true })
  useEventListener(canvasRef, 'mouseleave', () => (hovered.value = null))
  const stopViewport = editor.onEditorEvent('viewport:changed', () => (hovered.value = null))
  onScopeDispose(stopViewport)

  return { cursor: computed(() => (hovered.value ? 'pointer' : null)) }
}
