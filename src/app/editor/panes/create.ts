import { shallowReactive } from 'vue'

import { copyEditorViewState, createDefaultEditorViewState } from '@open-pencil/core/editor'
import type { EditorViewState } from '@open-pencil/core/editor'

import type { AppEditorState } from '@/app/editor/session/types'

import type { AppCanvasPaneState } from './types'

export function createCanvasPaneState(
  id: string,
  pageId: string,
  source?: Partial<
    EditorViewState & Pick<AppEditorState, 'cursorCanvasX' | 'cursorCanvasY' | 'nodeEditState'>
  >
): AppCanvasPaneState {
  const view = source
    ? copyEditorViewState({
        ...createDefaultEditorViewState(pageId),
        ...source,
        currentPageId: source.currentPageId ?? pageId
      })
    : createDefaultEditorViewState(pageId)

  return shallowReactive({
    ...view,
    id,
    selectedIds: new Set(source?.selectedIds ?? view.selectedIds),
    cursorCanvasX: source?.cursorCanvasX ?? null,
    cursorCanvasY: source?.cursorCanvasY ?? null,
    nodeEditState: source?.nodeEditState ?? null,
    pageViewports: new Map(),
    viewportWidth: 0,
    viewportHeight: 0
  })
}

export function clonePaneForSplit(id: string, source: AppCanvasPaneState): AppCanvasPaneState {
  return createCanvasPaneState(id, source.currentPageId, {
    ...source,
    selectedIds: new Set<string>(),
    hoveredNodeId: null,
    editingTextId: null,
    marquee: null,
    snapGuides: [],
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    autoLayoutHover: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    cursorCanvasX: null,
    cursorCanvasY: null,
    nodeEditState: null
  })
}
