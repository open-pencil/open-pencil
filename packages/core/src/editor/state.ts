import { CANVAS_BG_COLOR } from '#core/constants'
import type { EditorState } from '#core/editor/types'

export function createDefaultEditorState(pageId: string): EditorState {
  return {
    activeTool: 'SELECT',
    currentPageId: pageId,
    selectedIds: new Set<string>(),
    marquee: null,
    snapGuides: [],
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    hoveredNodeId: null,
    editingTextId: null,
    editingFrameTitleId: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    remoteCursors: [],
    autoLayoutHover: null,
    documentName: 'Untitled',
    panX: 0,
    pageColor: { ...CANVAS_BG_COLOR },
    panY: 0,
    zoom: 1,
    renderVersion: 0,
    sceneVersion: 0,
    loading: false,
    enteredContainerId: null
  }
}
