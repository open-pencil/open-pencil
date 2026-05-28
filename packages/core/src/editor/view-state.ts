import { getDefaultCanvasBgColor } from '#core/constants'

import type { EditorState } from './types'

export const EDITOR_VIEW_STATE_KEYS = [
  'currentPageId',
  'selectedIds',
  'marquee',
  'snapGuides',
  'rotationPreview',
  'dropTargetId',
  'layoutInsertIndicator',
  'autoLayoutHover',
  'hoveredNodeId',
  'editingTextId',
  'penState',
  'penCursorX',
  'penCursorY',
  'panX',
  'panY',
  'zoom',
  'renderVersion',
  'pageColor',
  'enteredContainerId'
] as const

export type EditorViewStateKey = (typeof EDITOR_VIEW_STATE_KEYS)[number]
export type EditorViewState = Pick<EditorState, EditorViewStateKey>

export function createDefaultEditorViewState(pageId: string): EditorViewState {
  return {
    currentPageId: pageId,
    selectedIds: new Set<string>(),
    marquee: null,
    snapGuides: [],
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    autoLayoutHover: null,
    hoveredNodeId: null,
    editingTextId: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    panX: 0,
    panY: 0,
    zoom: 1,
    renderVersion: 0,
    pageColor: { ...getDefaultCanvasBgColor() },
    enteredContainerId: null
  }
}

export function copyEditorViewState(source: EditorViewState): EditorViewState {
  return {
    ...source,
    selectedIds: new Set(source.selectedIds),
    snapGuides: structuredClone(source.snapGuides),
    rotationPreview: structuredClone(source.rotationPreview),
    layoutInsertIndicator: structuredClone(source.layoutInsertIndicator),
    autoLayoutHover: structuredClone(source.autoLayoutHover),
    penState: structuredClone(source.penState),
    pageColor: { ...source.pageColor },
    marquee: structuredClone(source.marquee)
  }
}
