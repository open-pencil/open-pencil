import type { Editor } from '@open-pencil/core/editor'

export function createCanvasRenderLoop(editor: Editor, renderNow: () => void) {
  let dirty = true
  let frameId: number | null = null
  let lastRenderVersion = -1
  let lastSelectedIds: Set<string> | null = null
  const scheduleRender = () => {
    dirty = true
    if (frameId !== null) return
    frameId = requestAnimationFrame(() => {
      frameId = null
      if (editor.state.loading) {
        scheduleRender()
        return
      }

      const versionChanged = editor.state.renderVersion !== lastRenderVersion
      const selectionChanged = editor.state.selectedIds !== lastSelectedIds
      if (dirty || versionChanged || selectionChanged) {
        dirty = false
        renderNow()
      }
    })
  }

  const unsubscribe = [
    editor.onEditorEvent('render:requested', scheduleRender),
    editor.onEditorEvent('repaint:requested', scheduleRender),
    editor.onEditorEvent('selection:changed', scheduleRender),
    editor.onEditorEvent('viewport:changed', scheduleRender)
  ]

  function markRendered() {
    lastRenderVersion = editor.state.renderVersion
    lastSelectedIds = editor.state.selectedIds
  }

  function pause() {
    for (const off of unsubscribe) off()
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  return {
    pause,
    markRendered,
    markDirty: scheduleRender
  }
}
