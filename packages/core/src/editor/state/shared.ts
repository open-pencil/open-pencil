import { DEFAULT_SNAPPING_PREFERENCES } from '#core/editor/preferences'
import type { EditorSharedState } from '#core/editor/types'
import { NO_HOST_RESTRICTIONS } from '#core/editor/views/profile'

export function createDefaultEditorSharedState(): EditorSharedState {
  return {
    activeTool: 'SELECT',
    shapeWithTextKind: 'SQUARE',
    // A copy, so one editor's state never shares an object with another's.
    hostRestrictions: { ...NO_HOST_RESTRICTIONS },
    documentKind: 'design',
    snappingPreferences: { ...DEFAULT_SNAPPING_PREFERENCES },
    showPixelGrid: true,
    showSizeLabels: true,
    gradientEdit: null,
    blurRampEdit: null,
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
