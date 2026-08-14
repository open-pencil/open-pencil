import type { EditorState } from './types'

export const EDITOR_SHARED_STATE_KEYS = [
  'activeTool',
  'remoteCursors',
  'documentName',
  'sceneVersion',
  'loading',
  'rulerTheme'
] as const satisfies readonly (keyof EditorState)[]

export type EditorSharedStateKey = (typeof EDITOR_SHARED_STATE_KEYS)[number]
export type EditorSharedState = Pick<EditorState, EditorSharedStateKey>
