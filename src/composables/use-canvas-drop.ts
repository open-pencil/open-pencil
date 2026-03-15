import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import { openFileInNewTab } from '@/stores/tabs'

import type { EditorStore } from '@/stores/editor'

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const DESIGN_EXTENSIONS = new Set(['.fig', '.pen'])

function hasDroppableFiles(e: DragEvent): boolean {
  if (!e.dataTransfer?.types.includes('Files')) return false
  for (const item of e.dataTransfer.items) {
    if (item.kind === 'file') return true
  }
  return false
}

function extractDesignFile(files: FileList | null): File | null {
  if (!files) return null
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (DESIGN_EXTENSIONS.has(ext)) return file
  }
  return null
}

export function useCanvasDrop(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  const isDraggingOver = ref(false)

  useEventListener(canvasRef, 'dragover', (e: DragEvent) => {
    if (!hasDroppableFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragenter', (e: DragEvent) => {
    if (!hasDroppableFiles(e)) return
    e.preventDefault()
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragleave', () => {
    isDraggingOver.value = false
  })

  useEventListener(canvasRef, 'drop', (e: DragEvent) => {
    e.preventDefault()
    isDraggingOver.value = false

    const designFile = extractDesignFile(e.dataTransfer?.files ?? null)
    if (designFile) {
      void openFileInNewTab(designFile)
      return
    }

    const files = filterImageFiles(e.dataTransfer?.files ?? null)
    if (!files.length) return

    const canvas = canvasRef.value
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: cx, y: cy } = store.screenToCanvas(sx, sy)

    void store.placeImageFiles(files, cx, cy)
  })

  return { isDraggingOver }
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
