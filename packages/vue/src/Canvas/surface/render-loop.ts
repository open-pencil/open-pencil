import { useRafFn } from '@vueuse/core'

import type { Editor } from '@open-pencil/core/editor'

export function createCanvasRenderLoop(editor: Editor, renderNow: () => void) {
  let dirty = true
  let lastRenderVersion = -1
  let lastSelectedIds: Set<string> | null = null

  function markRendered() {
    lastRenderVersion = editor.state.renderVersion
    lastSelectedIds = editor.state.selectedIds
  }

  const { pause } = useRafFn(() => {
    if (editor.state.loading) return
    const versionChanged = editor.state.renderVersion !== lastRenderVersion
    const selectionChanged = editor.state.selectedIds !== lastSelectedIds
    if (dirty || versionChanged || selectionChanged) {
      dirty = false
      renderNow()
    }
  })

  return {
    pause,
    markRendered,
    markDirty: () => {
      dirty = true
    }
  }
}
