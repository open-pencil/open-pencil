import { createGuideOverlayState } from '#core/canvas/guides/types'
import { CANVAS_BG_COLOR } from '#core/constants'
import type { EditorState, EditorViewState } from '#core/editor/types'

export function createDefaultEditorViewState(pageId: string): EditorViewState {
  return {
    currentPageId: pageId,
    selectedIds: new Set<string>(),
    marquee: null,
    snapGuides: [],
    guides: createGuideOverlayState(),
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    hoveredNodeId: null,
    measurementMode: 'off',
    editingTextId: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    autoLayoutHover: null,
    panX: 0,
    pageColor: { ...CANVAS_BG_COLOR },
    panY: 0,
    zoom: 1,
    navigation: { phase: 'idle', generation: 0, lastInputAt: 0 },
    renderVersion: 0,
    enteredContainerId: null,
    nodeEditState: null,
    cursorCanvasX: null,
    cursorCanvasY: null
  }
}

export function copyEditorViewState(source: EditorViewState): EditorViewState {
  return {
    ...source,
    selectedIds: new Set(source.selectedIds),
    marquee: structuredClone(source.marquee),
    snapGuides: structuredClone(source.snapGuides),
    guides: structuredClone(source.guides),
    rotationPreview: structuredClone(source.rotationPreview),
    layoutInsertIndicator: structuredClone(source.layoutInsertIndicator),
    penState: structuredClone(source.penState),
    autoLayoutHover: structuredClone(source.autoLayoutHover),
    pageColor: { ...source.pageColor },
    navigation: { ...source.navigation },
    nodeEditState: structuredClone(source.nodeEditState)
  }
}

export function pickEditorViewState(state: EditorState): EditorViewState {
  const defaults = createDefaultEditorViewState(state.currentPageId)
  const view = {} as EditorViewState
  for (const key of Object.keys(defaults) as Array<keyof EditorViewState>) {
    Reflect.set(view, key, state[key])
  }
  return copyEditorViewState(view)
}
