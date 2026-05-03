import {
  EXPORT_FORMATS,
  EXPORT_SCALES,
  createDefaultExportSetting,
  createExportSettingActions,
  createExportTargetState,
  formatSupportsScale
} from '#vue/document/export/helpers'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { ref } from 'vue'

export type ExportFormatId = 'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'fig'
export type ExportPanelTarget = 'selection' | 'page'

export interface ExportSetting {
  scale: number
  format: ExportFormatId
}

export function useExport() {
  const editor = useEditor()

  const selectionSettings = ref<ExportSetting[]>([createDefaultExportSetting()])
  const pageSettings = ref<ExportSetting[]>([createDefaultExportSetting()])
  const selectedIds = useSceneComputed(() => [...editor.state.selectedIds])

  const targetState = createExportTargetState(editor, selectedIds, selectionSettings, pageSettings)
  const settingActions = createExportSettingActions(selectionSettings, pageSettings)

  return {
    editor,
    selectedIds,
    scales: EXPORT_SCALES,
    formats: EXPORT_FORMATS,
    formatSupportsScale,
    selectionSettings,
    pageSettings,
    ...targetState,
    ...settingActions
  }
}
