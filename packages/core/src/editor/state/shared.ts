import { DEFAULT_SNAPPING_PREFERENCES } from '#core/editor/preferences'
import type { EditorSharedState } from '#core/editor/types'

export function createDefaultEditorSharedState(): EditorSharedState {
  return {
    activeTool: 'SELECT',
    shapeWithTextKind: 'SQUARE',
    hostRestrictions: { readOnly: false },
    documentKind: 'design',
    snappingPreferences: { ...DEFAULT_SNAPPING_PREFERENCES },
    showPixelGrid: true,
    gradientEdit: null,
    presenceCursors: [],
    documentName: 'Untitled',
    designIssues: null,
    codeFocusNodeId: null,
    rulerTheme: undefined,
    selectionTheme: undefined,
    sceneVersion: 0,
    canvasVersion: 0
  }
}
