import type { Editor } from '@open-pencil/core/editor'

import type { CanvasRenderLayer } from './types'

type RenderLoopOptions = {
  layer?: CanvasRenderLayer
}

function shouldScheduleForRepaint(layer: CanvasRenderLayer | undefined) {
  return layer !== 'scene'
}

function shouldScheduleForSelection(layer: CanvasRenderLayer | undefined) {
  return layer !== 'scene'
}

export function createCanvasRenderLoop(
  editor: Editor,
  renderNow: () => void,
  options: RenderLoopOptions = {}
) {
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
    editor.onEditorEvent('viewport:changed', scheduleRender)
  ]

  if (shouldScheduleForRepaint(options.layer)) {
    unsubscribe.push(editor.onEditorEvent('repaint:requested', scheduleRender))
  }

  if (shouldScheduleForSelection(options.layer)) {
    unsubscribe.push(editor.onEditorEvent('selection:changed', scheduleRender))
  }

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
