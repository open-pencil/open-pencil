import { useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'

import type { PlacedIssueMarker } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'

export interface CanvasIssueMarkerOptions {
  /** Marker under a point in canvas-element CSS pixels; `useCanvas()` returns one. */
  hitTest: (screenX: number, screenY: number) => PlacedIssueMarker | null
  /** Called when the pointer enters, moves between, or leaves markers. */
  onHover?: (marker: PlacedIssueMarker | null) => void
  /** Called on a primary click on a marker; the click never reaches selection or tools. */
  onActivate?: (marker: PlacedIssueMarker, event: MouseEvent) => void
}

/**
 * Makes design issue markers on an overlay canvas hoverable and clickable.
 *
 * Listeners run in the capture phase so a marker click is consumed before canvas input starts a
 * selection, marquee or drag. The hovered marker is cleared when the viewport moves, because the
 * marker layout it refers to is replaced on the next frame.
 */
export function useCanvasIssueMarkers(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options: CanvasIssueMarkerOptions
) {
  const hoveredMarker = shallowRef<PlacedIssueMarker | null>(null)
  /** Set by a click; the marker's details stay closed until the pointer moves to another one. */
  const dismissed = shallowRef(false)

  function localPoint(event: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function setHovered(marker: PlacedIssueMarker | null) {
    const previous = hoveredMarker.value
    if (previous?.key === marker?.key && previous?.count === marker?.count) return
    hoveredMarker.value = marker
    editor.setHoveredIssueMarker(marker?.key ?? null)
    options.onHover?.(marker)
  }

  function onMouseMove(event: MouseEvent) {
    if (event.buttons !== 0) {
      setHovered(null)
      return
    }
    const point = localPoint(event)
    const marker = point ? options.hitTest(point.x, point.y) : null
    if (marker?.key !== hoveredMarker.value?.key) dismissed.value = false
    setHovered(marker)
    if (!marker) return
    editor.setHoveredNode(null)
    event.stopImmediatePropagation()
  }

  function onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return
    const point = localPoint(event)
    const marker = point ? options.hitTest(point.x, point.y) : null
    if (!marker) return
    event.preventDefault()
    event.stopImmediatePropagation()
    dismissed.value = true
    options.onActivate?.(marker, event)
  }

  useEventListener(canvasRef, 'mousemove', onMouseMove, { capture: true })
  useEventListener(canvasRef, 'mousedown', onMouseDown, { capture: true })
  useEventListener(canvasRef, 'mouseleave', () => setHovered(null))
  const stopViewport = editor.onEditorEvent('viewport:changed', () => setHovered(null))
  const stopPage = editor.onEditorEvent('page:changed', () => setHovered(null))
  onScopeDispose(() => {
    stopViewport()
    stopPage()
    if (hoveredMarker.value) editor.setHoveredIssueMarker(null)
  })

  return {
    hoveredMarker,
    /** The hovered marker unless a click dismissed its details. */
    detailMarker: computed(() => (dismissed.value ? null : hoveredMarker.value)),
    cursor: computed(() => (hoveredMarker.value ? 'pointer' : null))
  }
}
