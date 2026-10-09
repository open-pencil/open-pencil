import { DEFAULT_SNAPPING_PREFERENCES } from '#core/editor/preferences'
import type { EditorSharedState } from '#core/editor/types'

export function createDefaultEditorSharedState(): EditorSharedState {
  return {
    activeTool: 'SELECT',
    snappingPreferences: { ...DEFAULT_SNAPPING_PREFERENCES },
    showPixelGrid: true,
    gradientEdit: null,
    presenceCursors: [],
    documentName: 'Untitled',
    designIssues: null,
    codeFocusNodeId: null,
    rulerTheme: undefined,
    sceneVersion: 0,
    canvasVersion: 0
  }
}
