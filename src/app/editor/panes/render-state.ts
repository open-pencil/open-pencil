import type { EditorState } from '@open-pencil/core/editor'

import type { AppEditorState } from '@/app/editor/session/types'

import type { AppCanvasPaneState } from './types'

export function composePaneRenderState(
  sharedState: AppEditorState,
  pane: AppCanvasPaneState
): EditorState {
  return {
    activeTool: sharedState.activeTool,
    remoteCursors: sharedState.showRemoteCursors
      ? sharedState.remoteCursors.filter(
          (cursor) => !cursor.pageId || cursor.pageId === pane.currentPageId
        )
      : [],
    documentName: sharedState.documentName,
    sceneVersion: sharedState.sceneVersion,
    loading: sharedState.loading,
    rulerTheme: sharedState.rulerTheme,
    currentPageId: pane.currentPageId,
    selectedIds: pane.selectedIds,
    marquee: pane.marquee,
    snapGuides: pane.snapGuides,
    rotationPreview: pane.rotationPreview,
    dropTargetId: pane.dropTargetId,
    layoutInsertIndicator: pane.layoutInsertIndicator,
    autoLayoutHover: pane.autoLayoutHover,
    hoveredNodeId: pane.hoveredNodeId,
    editingTextId: pane.editingTextId,
    penState: pane.penState,
    penCursorX: pane.penCursorX,
    penCursorY: pane.penCursorY,
    panX: pane.panX,
    panY: pane.panY,
    zoom: pane.zoom,
    renderVersion: pane.renderVersion,
    pageColor: pane.pageColor,
    enteredContainerId: pane.enteredContainerId,
    cursorCanvasX: pane.cursorCanvasX,
    cursorCanvasY: pane.cursorCanvasY,
    nodeEditState: pane.nodeEditState
  }
}
