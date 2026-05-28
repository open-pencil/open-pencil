import type { EditorState } from './types'

export const EDITOR_SHARED_STATE_KEYS = [
  'activeTool',
  'remoteCursors',
  'documentName',
  'sceneVersion',
  'loading',
  'rulerTheme'
] as const

export type EditorSharedStateKey = (typeof EDITOR_SHARED_STATE_KEYS)[number]
export type EditorSharedState = Pick<EditorState, EditorSharedStateKey>

export function createDefaultEditorSharedState(): EditorSharedState {
  return {
    activeTool: 'SELECT',
    remoteCursors: [],
    documentName: 'Untitled',
    sceneVersion: 0,
    loading: false,
    rulerTheme: undefined
  }
}
