import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import type { EditorStore } from '@/stores/editor'

const RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const SVG_TYPE = 'image/svg+xml'
const COMPONENT_MIME = 'application/x-openpencil-component'
const IMAGE_ASSET_MIME = 'application/x-openpencil-image-asset'

function isSVGFile(file: File): boolean {
  return file.type === SVG_TYPE || file.name.endsWith('.svg')
}

export function useCanvasDrop(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  const isDraggingOver = ref(false)

  useEventListener(canvasRef, 'dragover', (e: DragEvent) => {
    if (hasComponentData(e) || hasImageAssetData(e)) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      isDraggingOver.value = true
      return
    }
    if (!hasDroppableFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragenter', (e: DragEvent) => {
    if (hasComponentData(e) || hasImageAssetData(e) || hasDroppableFiles(e)) {
      e.preventDefault()
      isDraggingOver.value = true
    }
  })

  useEventListener(canvasRef, 'dragleave', () => {
    isDraggingOver.value = false
  })

  useEventListener(canvasRef, 'drop', (e: DragEvent) => {
    e.preventDefault()
    isDraggingOver.value = false

    const componentId = e.dataTransfer?.getData(COMPONENT_MIME)
    if (componentId) {
      const canvas = canvasRef.value
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { x, y } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
      store.createInstanceFromComponent(componentId, x, y, store.state.currentPageId)
      return
    }

    const imageHash = e.dataTransfer?.getData(IMAGE_ASSET_MIME)
    if (imageHash) {
      const canvas = canvasRef.value
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { x, y } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)
      store.placeImageFromHash(imageHash, x, y)
      return
    }

    const allFiles = e.dataTransfer?.files
    if (!allFiles || allFiles.length === 0) return

    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { x: cx, y: cy } = store.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top)

    const svgFiles: File[] = []
    const rasterFiles: File[] = []
    for (const file of allFiles) {
      if (isSVGFile(file)) svgFiles.push(file)
      else if (RASTER_TYPES.has(file.type)) rasterFiles.push(file)
    }

    if (svgFiles.length > 0) {
      void (async () => {
        for (const file of svgFiles) {
          const text = await file.text()
          store.placeSVGFile(text, cx, cy, file.name)
        }
      })()
    }

    if (rasterFiles.length > 0) {
      void store.placeImageFiles(rasterFiles, cx, cy)
    }
  })

  return { isDraggingOver }
}

function hasComponentData(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(COMPONENT_MIME) ?? false
}

function hasImageAssetData(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes(IMAGE_ASSET_MIME) ?? false
}

function hasDroppableFiles(e: DragEvent): boolean {
  if (!e.dataTransfer?.types.includes('Files')) return false
  for (const item of e.dataTransfer.items) {
    if (item.kind === 'file' && (RASTER_TYPES.has(item.type) || item.type === SVG_TYPE)) return true
  }
  return false
}

function filterRasterFiles(files: FileList | null): File[] {
  if (!files) return []
  const result: File[] = []
  for (const file of files) {
    if (RASTER_TYPES.has(file.type)) result.push(file)
  }
  return result
}

export function extractImageFilesFromClipboard(e: ClipboardEvent): File[] {
  return filterRasterFiles(e.clipboardData?.files ?? null)
}
