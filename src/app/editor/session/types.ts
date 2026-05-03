import { createDefaultEditorState, type EditorState } from '@open-pencil/core/editor'

import type { NodeEditState } from '@/app/editor/vector-edit/types'
import type { Fill, SceneNode, VectorSegment, VectorVertex } from '@open-pencil/core/scene-graph'
import type { Vector } from '@open-pencil/core/types'

export function createInitialAppEditorState(pageId: string): AppEditorState {
  return {
    ...createDefaultEditorState(pageId),
    showUI: true,
    showRulers: true,
    showRemoteCursors: true,
    activeRibbonTab: 'panels',
    panelMode: 'design',
    actionToast: null,
    mobileDrawerSnap: 'closed',
    clipboardHtml: '',
    autosaveEnabled: false,
    cursorCanvasX: null,
    cursorCanvasY: null,
    nodeEditState: null,
    scrubInputFocused: false
  }
}

export type AppEditorState = Omit<EditorState, 'penState'> & {
  penState: {
    vertices: VectorVertex[]
    segments: VectorSegment[]
    dragTangent: Vector | null
    oppositeDragTangent: Vector | null
    closingToFirst: boolean
    pendingClose?: boolean
    resumingNodeId?: string
    resumedFills?: Fill[]
    resumedStrokes?: SceneNode['strokes']
  } | null
  showUI: boolean
  showRulers: boolean
  showRemoteCursors: boolean
  activeRibbonTab: 'panels' | 'code' | 'ai'
  panelMode: 'layers' | 'design'
  actionToast: string | null
  mobileDrawerSnap: 'closed' | 'half' | 'full'
  clipboardHtml: string
  autosaveEnabled: boolean
  cursorCanvasX: number | null
  cursorCanvasY: number | null
  nodeEditState: NodeEditState | null
  scrubInputFocused: boolean
}
