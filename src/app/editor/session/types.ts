import { createDefaultEditorState, type EditorState } from '@open-pencil/core/editor'

import type { EditorPreparation } from '@/app/editor/preparation/types'
import type { NodeEditState } from '@/app/editor/vector/types'
import { appPreferences } from '@/app/settings/preferences/store'

export function createInitialAppEditorState(pageId: string): AppEditorState {
  return {
    ...createDefaultEditorState(pageId),
    snappingPreferences: { ...appPreferences.value.editing.snapping },
    showUI: true,
    showRulers: true,
    showRemoteCursors: true,
    activeRibbonTab: 'panels',
    panelMode: 'design',
    actionToast: null,
    mobileDrawerSnap: 'closed',
    autosaveEnabled: false,
    cursorCanvasX: null,
    cursorCanvasY: null,
    nodeEditState: null,
    renameSelectionOpen: false,
    renameNodeId: null,
    numberFieldFocused: false,
    preparation: null
  }
}

export type AppEditorState = EditorState & {
  showUI: boolean
  showRulers: boolean
  showRemoteCursors: boolean
  activeRibbonTab: 'panels' | 'code' | 'ai'
  panelMode: 'layers' | 'design'
  actionToast: string | null
  mobileDrawerSnap: 'closed' | 'half' | 'full'
  autosaveEnabled: boolean
  cursorCanvasX: number | null
  cursorCanvasY: number | null
  nodeEditState: NodeEditState | null
  renameSelectionOpen: boolean
  renameNodeId: string | null
  numberFieldFocused: boolean
  preparation: EditorPreparation | null
}
