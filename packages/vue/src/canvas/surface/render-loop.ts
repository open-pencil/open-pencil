import type { Editor, EditorState } from '@open-pencil/core/editor'

import type { CanvasRenderLayer } from './types'

type RenderLoopOptions = {
  layer?: CanvasRenderLayer
  getRenderState?: () => EditorState
}

type EditorRenderScheduler = {
  schedule: (callback: () => void) => void
  cancel: (callback: () => void) => void
}

const renderSchedulers = new WeakMap<Editor, EditorRenderScheduler>()

function getRenderScheduler(editor: Editor): EditorRenderScheduler {
  const existing = renderSchedulers.get(editor)
  if (existing) return existing

  let frameId: number | null = null
  const callbacks = new Set<() => void>()

  function flush() {
    frameId = null
    const pending = [...callbacks]
    callbacks.clear()
    for (const callback of pending) callback()
  }

  const scheduler = {
    schedule(callback: () => void) {
      callbacks.add(callback)
      if (frameId !== null) return
      frameId = requestAnimationFrame(flush)
    },
    cancel(callback: () => void) {
      callbacks.delete(callback)
      if (callbacks.size === 0 && frameId !== null) {
        cancelAnimationFrame(frameId)
        frameId = null
      }
    }
  }

  renderSchedulers.set(editor, scheduler)
  return scheduler
}

function shouldScheduleForSelection(layer: CanvasRenderLayer | undefined) {
  return layer !== 'scene'
}

export function createCanvasRenderLoop(
  editor: Editor,
  renderNow: () => void,
  options: RenderLoopOptions = {}
) {
  const getRenderState = options.getRenderState ?? (() => editor.state)
  const scheduler = getRenderScheduler(editor)
  let dirty = true
  let frameScheduled = false
  let lastRenderVersion = -1
  let lastSceneVersion = -1
  let lastSelectedIds: Set<string> | null = null

  function renderFrame() {
    frameScheduled = false
    const state = getRenderState()
    if (state.loading) {
      dirty = true
      scheduleFrame()
      return
    }

    const versionChanged = state.renderVersion !== lastRenderVersion
    const sceneChanged = state.sceneVersion !== lastSceneVersion
    const selectionChanged = state.selectedIds !== lastSelectedIds
    if (dirty || versionChanged || sceneChanged || selectionChanged) {
      dirty = false
      renderNow()
    }
  }

  const scheduleFrame = () => {
    if (frameScheduled) return
    frameScheduled = true
    scheduler.schedule(renderFrame)
  }

  const scheduleDirtyFrame = () => {
    dirty = true
    scheduleFrame()
  }

  const unsubscribe = [
    editor.onEditorEvent('render:requested', scheduleDirtyFrame),
    editor.onEditorEvent('viewport:changed', scheduleFrame),
    editor.onEditorEvent('repaint:requested', scheduleDirtyFrame)
  ]

  if (shouldScheduleForSelection(options.layer)) {
    unsubscribe.push(editor.onEditorEvent('selection:changed', scheduleFrame))
  }

  function markRendered() {
    const state = getRenderState()
    lastRenderVersion = state.renderVersion
    lastSceneVersion = state.sceneVersion
    lastSelectedIds = state.selectedIds
  }

  function pause() {
    for (const off of unsubscribe) off()
    if (frameScheduled) {
      scheduler.cancel(renderFrame)
      frameScheduled = false
    }
  }

  return {
    pause,
    markRendered,
    markDirty() {
      dirty = true
      scheduleFrame()
    }
  }
}
