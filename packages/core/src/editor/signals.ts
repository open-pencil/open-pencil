import { createNanoEvents } from 'nanoevents'
import type { Emitter } from 'nanoevents'

import { emitNavigationTrace } from '#core/profiler'

import type { EditorEventName, EditorEvents, EditorState, RenderVersions } from './types'
import { offeredTool } from './views'

/**
 * The editor's event emitter and the state changes every view follows: the render, scene, and
 * canvas versions a canvas draws by, live edits, navigation, the selection, and the active tool.
 * Each change bumps its version or emits its event, so views never compare state themselves.
 */
export function createEditorSignals(state: EditorState) {
  const events: Emitter<EditorEvents> = createNanoEvents()
  const interactiveEdits = new Set<symbol>()

  function emitEditorEvent<K extends EditorEventName>(
    event: K,
    ...args: Parameters<EditorEvents[K]>
  ) {
    events.emit(event, ...args)
  }

  function onEditorEvent<K extends EditorEventName>(event: K, handler: EditorEvents[K]) {
    return events.on(event, handler)
  }

  function requestRender() {
    state.renderVersion++
    state.sceneVersion++
    state.canvasVersion++
    emitNavigationTrace('render:requested', {
      kind: 'render',
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
    emitEditorEvent('render:requested', {
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
  }

  /**
   * The caret or selection of the edited text moved: the canvas repaints its overlay and the
   * views that follow the selection update, without the document counting as changed.
   */
  function textSelectionChanged() {
    state.textSelectionVersion++
    requestRepaint()
  }

  function requestRefresh() {
    state.sceneVersion++
  }

  /** A canvas showed a frame of `versions` with nothing left to fill in. */
  function reportPresented(versions: RenderVersions) {
    emitEditorEvent('render:presented', versions)
  }

  function requestRepaint() {
    state.renderVersion++
    emitNavigationTrace('render:requested', {
      kind: 'repaint',
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
    emitEditorEvent('repaint:requested', {
      renderVersion: state.renderVersion,
      sceneVersion: state.sceneVersion
    })
  }

  /** Track an actual live edit independently of history batching. Release is idempotent. */
  function beginInteractiveEdit() {
    const token = Symbol('interactive-edit')
    interactiveEdits.add(token)
    requestRepaint()
    return () => {
      if (interactiveEdits.delete(token)) requestRepaint()
    }
  }

  function setNavigationPhase(phase: EditorState['navigation']['phase'], inputAt = 0) {
    const previous = { ...state.navigation }
    const active = phase === 'pan' || phase === 'zoom' || phase === 'momentum'
    const wasActive =
      previous.phase === 'pan' || previous.phase === 'zoom' || previous.phase === 'momentum'
    state.navigation = {
      phase,
      generation: active && !wasActive ? previous.generation + 1 : previous.generation,
      lastInputAt: inputAt || previous.lastInputAt
    }
    if (
      state.navigation.phase !== previous.phase ||
      state.navigation.generation !== previous.generation ||
      state.navigation.lastInputAt !== previous.lastInputAt
    ) {
      emitNavigationTrace('navigation:phase', {
        phase: state.navigation.phase,
        previousPhase: previous.phase,
        generation: state.navigation.generation,
        lastInputAt: state.navigation.lastInputAt
      })
      emitEditorEvent('navigation:changed', state.navigation, previous)
    }
  }

  function setSelectedIds(ids: Set<string>) {
    const previous = [...state.selectedIds]
    state.selectedIds = ids
    if (ids.size === 0) state.measurementMode = 'off'
    const selected = [...ids]
    if (
      previous.length !== selected.length ||
      previous.some((id, index) => id !== selected[index])
    ) {
      emitEditorEvent('selection:changed', selected, previous)
    }
  }

  function setActiveTool(tool: EditorState['activeTool']) {
    if (offeredTool(state, tool) !== tool) return
    const previous = state.activeTool
    state.activeTool = tool
    if (tool !== 'SELECT') state.measurementMode = 'off'
    if (previous === tool) return
    // The Scale tool starts from the center of the box, as Figma's does.
    if (tool === 'SCALE') state.scaleAnchor = { x: 0.5, y: 0.5 }
    // Guides the pen showed for its next point do not belong to the next tool.
    if (previous === 'PEN') state.snapGuides = []
    emitEditorEvent('tool:changed', tool, previous)
  }

  return {
    emitEditorEvent,
    onEditorEvent,
    requestRender,
    textSelectionChanged,
    requestRefresh,
    reportPresented,
    requestRepaint,
    beginInteractiveEdit,
    isInteractiveEditing: () => interactiveEdits.size > 0,
    /** Forgets every live edit, as disposing the editor does, without repainting. */
    clearInteractiveEdits: () => interactiveEdits.clear(),
    setNavigationPhase,
    setSelectedIds,
    setActiveTool
  }
}
