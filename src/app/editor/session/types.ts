import {
  createDefaultEditorState,
  type EditorState,
  type SwitchPageOptions
} from '@open-pencil/core'
import type { DocumentColorSpace } from '@open-pencil/scene-graph'
import type { PresentationColorSpace } from '@open-pencil/vue/canvas/surface'

import type { EditorPreparation, EditorPreparationHandle } from '@/app/editor/preparation/types'
import { appPreferences } from '@/app/settings/preferences/store'
import { resolvedAppTheme } from '@/app/shell/theme'

export function createInitialAppEditorState(pageId: string): AppEditorState {
  return {
    ...createDefaultEditorState(pageId),
    // New pages and sections take their colors from the interface theme, as in Figma.
    theme: resolvedAppTheme.value,
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
    renameSelectionOpen: false,
    variablesOpen: false,
    statusesOpen: false,
    iconPickerOpen: false,
    renameNodeId: null,
    numberFieldFocused: false,
    preparation: null,
    canvasPresentation: null,
    documentColorSpace: 'srgb'
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
  renameSelectionOpen: boolean
  /** The variables dialog, opened from the Design panel, the View menu, or the palette. */
  variablesOpen: boolean
  /** The statuses dialog, opened from the Status section, the canvas menu, or the page panel. */
  statusesOpen: boolean
  /** The icon picker, opened from the toolbar, the Object menu, or the palette. */
  iconPickerOpen: boolean
  renameNodeId: string | null
  numberFieldFocused: boolean
  preparation: EditorPreparation | null
  /** Color space the canvas is presenting, reported by the surface. */
  canvasPresentation: PresentationColorSpace | null
  /** Mirror of the document's color space, kept reactive for UI. */
  documentColorSpace: DocumentColorSpace
}

/** How the app switches pages: inside a preparation, with the loader up until the page is shown. */
export interface AppSwitchPageOptions {
  /** The preparation the switch belongs to, such as a document opening; else it starts its own. */
  preparation?: EditorPreparationHandle
  /**
   * Runs once the page is committed and before its first frame counts as shown, such as
   * fitting the viewport, so what appears is drawn where it will stay.
   */
  beforePresentation?: () => void | Promise<void>
  onProgress?: SwitchPageOptions['onProgress']
}
