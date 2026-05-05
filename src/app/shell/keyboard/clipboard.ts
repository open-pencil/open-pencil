import { useEventListener } from '@vueuse/core'

import { extractImageFilesFromClipboard } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'
import { isEditing } from '@/app/shell/keyboard/focus'

export function bindEditorClipboard(store: EditorStore) {
  useEventListener(window, 'copy', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) void store.writeCopyData(e.clipboardData)
  })

  useEventListener(window, 'cut', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) void store.writeCopyData(e.clipboardData)
    store.deleteSelected()
  })

  useEventListener(window, 'paste', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()

    const { cursorCanvasX: ccx, cursorCanvasY: ccy } = store.state
    const cursorPos = ccx != null && ccy != null ? { x: ccx, y: ccy } : undefined

    const imageFiles = extractImageFilesFromClipboard(e)
    if (imageFiles.length) {
      const cx = cursorPos?.x ?? (-store.state.panX + window.innerWidth / 2) / store.state.zoom
      const cy = cursorPos?.y ?? (-store.state.panY + window.innerHeight / 2) / store.state.zoom
      void store.placeImageFiles(imageFiles, cx, cy)
      return
    }

    const html = e.clipboardData?.getData('text/html') ?? ''
    if (html) void store.pasteFromHTML(html, cursorPos)
  })
}
