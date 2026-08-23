import { DEFAULT_SNAPPING_PREFERENCES } from '#core/editor/preferences'
import type { EditorSharedState } from '#core/editor/types'

export function createDefaultEditorSharedState(): EditorSharedState {
  return {
    activeTool: 'SELECT',
    snappingPreferences: { ...DEFAULT_SNAPPING_PREFERENCES },
    remoteCursors: [],
    documentName: 'Untitled',
    rulerTheme: undefined,
    sceneVersion: 0,
    loading: false
  }
}
