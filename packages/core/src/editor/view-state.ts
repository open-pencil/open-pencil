import type { EditorState } from './types'

export const EDITOR_VIEW_STATE_KEYS = [
  'currentPageId',
  'selectedIds',
  'marquee',
  'snapGuides',
  'rotationPreview',
  'dropTargetId',
  'layoutInsertIndicator',
  'hoveredNodeId',
  'editingTextId',
  'penState',
  'penCursorX',
  'penCursorY',
  'autoLayoutHover',
  'panX',
  'pageColor',
  'panY',
  'zoom',
  'renderVersion',
  'enteredContainerId',
  'nodeEditState',
  'cursorCanvasX',
  'cursorCanvasY',
  'measurementMode'
] as const satisfies readonly (keyof EditorState)[]

export type EditorViewStateKey = (typeof EDITOR_VIEW_STATE_KEYS)[number]
export type EditorViewState = Pick<EditorState, EditorViewStateKey>

export function copyEditorViewState(source: EditorViewState): EditorViewState {
  return {
    ...source,
    selectedIds: new Set(source.selectedIds),
    marquee: structuredClone(source.marquee),
    snapGuides: structuredClone(source.snapGuides),
    rotationPreview: structuredClone(source.rotationPreview),
    layoutInsertIndicator: structuredClone(source.layoutInsertIndicator),
    penState: structuredClone(source.penState),
    autoLayoutHover: structuredClone(source.autoLayoutHover),
    pageColor: { ...source.pageColor },
    nodeEditState: structuredClone(source.nodeEditState)
  }
}

export function pickEditorViewState(state: EditorState): EditorViewState {
  const view = {} as EditorViewState
  for (const key of EDITOR_VIEW_STATE_KEYS) Reflect.set(view, key, state[key])
  return view
}
