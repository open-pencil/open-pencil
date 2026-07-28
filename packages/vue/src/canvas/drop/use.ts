import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { findMoveDropTarget } from '#vue/shared/input/drop-target'

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const COMPONENT_MIME = 'application/x-openpencil-component'

function hasComponentData(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(COMPONENT_MIME) ?? false
}

function dropPoint(e: DragEvent, canvas: HTMLCanvasElement, editor: Editor) {
  const rect = canvas.getBoundingClientRect()
  return editor.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
}

function componentDropPlacement(componentId: string, cx: number, cy: number, editor: Editor) {
  const component = editor.graph.getNode(componentId)
  if (component?.type !== 'COMPONENT') return null

  const target = findMoveDropTarget(cx, cy, editor)
  const parentId = target?.id ?? editor.state.currentPageId
  const parentOffset =
    parentId === editor.state.currentPageId
      ? { x: 0, y: 0 }
      : editor.graph.getAbsolutePosition(parentId)
  return {
    parentId,
    x: cx - parentOffset.x - component.width / 2,
    y: cy - parentOffset.y - component.height / 2
  }
}

export function useCanvasDrop(canvasRef: Ref<HTMLCanvasElement | null>, editor: Editor) {
  const isDraggingOver = ref(false)

  useEventListener(canvasRef, 'dragover', (e: DragEvent) => {
    if (!hasComponentData(e) && !hasImageFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragenter', (e: DragEvent) => {
    if (!hasComponentData(e) && !hasImageFiles(e)) return
    e.preventDefault()
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragleave', () => {
    isDraggingOver.value = false
  })

  useEventListener(canvasRef, 'drop', (e: DragEvent) => {
    e.preventDefault()
    isDraggingOver.value = false

    const canvas = canvasRef.value
    if (!canvas) return
    const point = dropPoint(e, canvas, editor)

    const componentId = e.dataTransfer?.getData(COMPONENT_MIME)
    if (componentId) {
      const placement = componentDropPlacement(componentId, point.x, point.y, editor)
      if (!placement) return
      editor.createInstanceFromComponent(componentId, placement.x, placement.y, placement.parentId)
      editor.requestRender()
      return
    }

    const files = filterImageFiles(e.dataTransfer?.files ?? null)
    if (!files.length) return
    void editor.placeImageFiles(files, point.x, point.y)
  })

  return { isDraggingOver }
}

function hasImageFiles(e: DragEvent): boolean {
  if (!e.dataTransfer?.types.includes('Files')) return false
  for (const item of e.dataTransfer.items) {
    if (item.kind === 'file' && ACCEPTED_TYPES.has(item.type)) return true
  }
  return false
}

function filterImageFiles(files: FileList | null): File[] {
  if (!files) return []
  const result: File[] = []
  for (const file of files) {
    if (ACCEPTED_TYPES.has(file.type)) result.push(file)
  }
  return result
}

export function extractImageFilesFromClipboard(e: ClipboardEvent): File[] {
  return filterImageFiles(e.clipboardData?.files ?? null)
}
