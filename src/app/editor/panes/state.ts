import { shallowReactive } from 'vue'

import type { EditorState, EditorViewState } from '@open-pencil/core/editor'
import { copyEditorViewState, pickEditorViewState } from '@open-pencil/core/editor'

export interface CanvasPaneState extends EditorViewState {
  id: string
  viewportWidth: number
  viewportHeight: number
}

export function createCanvasPaneState(
  id: string,
  state: EditorState,
  overrides: Partial<EditorViewState> = {}
): CanvasPaneState {
  const view = copyEditorViewState({ ...pickEditorViewState(state), ...overrides })
  return shallowReactive({
    ...view,
    id,
    viewportWidth: 0,
    viewportHeight: 0
  })
}

export function cloneCanvasPaneState(id: string, source: CanvasPaneState): CanvasPaneState {
  return shallowReactive({
    ...copyEditorViewState(source),
    id,
    selectedIds: new Set<string>(),
    hoveredNodeId: null,
    measurementMode: 'off',
    editingTextId: null,
    marquee: null,
    snapGuides: [],
    guides: { preview: null, hovered: null, selected: null, redline: null },
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    autoLayoutHover: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    nodeEditState: null,
    cursorCanvasX: null,
    cursorCanvasY: null,
    viewportWidth: source.viewportWidth,
    viewportHeight: source.viewportHeight
  })
}
