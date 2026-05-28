import { useEventListener } from '@vueuse/core'

import { extractImageFilesFromClipboard } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'
import { paneCanvasCenter } from '@/app/editor/panes/viewport'
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
      const center = paneCanvasCenter(store.getActivePane())
      const cx = cursorPos?.x ?? center.x
      const cy = cursorPos?.y ?? center.y
      void store.placeImageFiles(imageFiles, cx, cy)
      return
    }

    const html = e.clipboardData?.getData('text/html') ?? ''
    if (html) void store.pasteFromHTML(html, cursorPos)
  })
}
