import type { EditorSharedState } from '#core/editor/types'

export function createDefaultEditorSharedState(): EditorSharedState {
  return {
    activeTool: 'SELECT',
    remoteCursors: [],
    documentName: 'Untitled',
    rulerTheme: undefined,
    sceneVersion: 0,
    loading: false
  }
}
