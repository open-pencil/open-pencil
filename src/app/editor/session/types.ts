import { createDefaultEditorState, type EditorState } from '@open-pencil/core/editor'

import type { NodeEditState } from '@/app/editor/vector-edit/types'

export function createInitialAppEditorState(pageId: string): AppEditorState {
  return {
    ...createDefaultEditorState(pageId),
    showUI: true,
    showRulers: true,
    showRemoteCursors: true,
    activeRibbonTab: 'panels',
    panelMode: 'design',
    viewMode: 'design',
    actionToast: null,
    mobileDrawerSnap: 'closed',
    clipboardHtml: '',
    autosaveEnabled: false,
    cursorCanvasX: null,
    cursorCanvasY: null,
    nodeEditState: null,
    renameSelectionOpen: false,
    renameNodeId: null,
    numberFieldFocused: false
  }
}

export type AppEditorState = EditorState & {
  showUI: boolean
  showRulers: boolean
  showRemoteCursors: boolean
  activeRibbonTab: 'panels' | 'code' | 'ai'
  panelMode: 'layers' | 'design'
  /** Left-rail layout: design = pages+layers; slides = filmstrip for .deck */
  viewMode: 'design' | 'slides'
  actionToast: string | null
  mobileDrawerSnap: 'closed' | 'half' | 'full'
  clipboardHtml: string
  autosaveEnabled: boolean
  cursorCanvasX: number | null
  cursorCanvasY: number | null
  nodeEditState: NodeEditState | null
  renameSelectionOpen: boolean
  renameNodeId: string | null
  numberFieldFocused: boolean
}
