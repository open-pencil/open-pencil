import {
  EXPORT_FORMATS,
  EXPORT_SCALES,
  MAX_EXPORT_SCALE,
  MIN_EXPORT_SCALE,
  clampExportScale,
  createExportSettingActions,
  createExportTargetState,
  formatSupportsScale
} from '#vue/document/export/helpers'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

export type { ExportFormatId, ExportSetting } from '@open-pencil/core/scene-graph'
export type { ExportPanelTarget } from '#vue/document/export/helpers'

export function useExport() {
  const editor = useEditor()

  const selectedIds = useSceneComputed(() => [...editor.state.selectedIds])

  const targetState = createExportTargetState(editor, selectedIds)
  const settingActions = createExportSettingActions(editor, targetState.targetIds)

  return {
    editor,
    selectedIds,
    scales: EXPORT_SCALES,
    maxScale: MAX_EXPORT_SCALE,
    minScale: MIN_EXPORT_SCALE,
    clampExportScale,
    formats: EXPORT_FORMATS,
    formatSupportsScale,
    ...targetState,
    ...settingActions
  }
}
