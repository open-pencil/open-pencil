import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import type { Editor } from '@inkly/core/editor'

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const DESIGN_EXTENSIONS = new Set(['.pen', '.fig'])

export function useCanvasDrop(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  onDesignFileDrop?: (file: File) => void
) {
  const isDraggingOver = ref(false)

  useEventListener(canvasRef, 'dragover', (e: DragEvent) => {
    if (!hasAcceptedFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragenter', (e: DragEvent) => {
    if (!hasAcceptedFiles(e)) return
    e.preventDefault()
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragleave', () => {
    isDraggingOver.value = false
  })

  useEventListener(canvasRef, 'drop', (e: DragEvent) => {
    e.preventDefault()
    isDraggingOver.value = false

    const designFile = findDesignFile(e.dataTransfer?.files ?? null)
    if (designFile && onDesignFileDrop) {
      onDesignFileDrop(designFile)
      return
    }

    const files = filterImageFiles(e.dataTransfer?.files ?? null)
    if (!files.length) return

    const canvas = canvasRef.value
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: cx, y: cy } = editor.screenToCanvas(sx, sy)

    void editor.placeImageFiles(files, cx, cy)
  })

  return { isDraggingOver }
}

function hasAcceptedFiles(e: DragEvent): boolean {
  if (!e.dataTransfer?.types.includes('Files')) return false
  for (const item of e.dataTransfer.items) {
    if (item.kind !== 'file') continue
    if (ACCEPTED_TYPES.has(item.type)) return true
    const name = (item as unknown as { name?: string }).name ?? ''
    if (DESIGN_EXTENSIONS.has(extOf(name))) return true
  }
  return true
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function findDesignFile(files: FileList | null): File | null {
  if (!files) return null
  for (const file of files) {
    if (DESIGN_EXTENSIONS.has(extOf(file.name))) return file
  }
  return null
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
