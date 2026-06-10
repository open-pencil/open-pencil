import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { MAX_EXPORT_SCALE, MIN_EXPORT_SCALE, clampExportScale } from '@open-pencil/core/scene-graph'
import type { ExportFormatId, ExportSetting, PluginDataEntry } from '@open-pencil/core/scene-graph'

import { useSceneComputed } from '#vue/internal/scene-computed/use'

export const EXPORT_SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const
export const EXPORT_FORMATS: ExportFormatId[] = ['png', 'jpg', 'webp', 'svg', 'pdf']

export type ExportPanelTarget = 'selection' | 'page'

const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
const EXPORT_SETTINGS_PLUGIN_KEY = 'exportSettings'

// Re-exported from core so the UI and the .fig file-format boundary share one
// definition of the export-scale bounds (see scene-graph/export-scale).
export { MIN_EXPORT_SCALE, MAX_EXPORT_SCALE, clampExportScale }

const io = new IORegistry(BUILTIN_IO_FORMATS)

export function createDefaultExportSetting(): ExportSetting {
  return { scale: 1, format: 'png' }
}

export function formatSupportsScale(format: ExportFormatId) {
  return io.getFormat(format)?.exportOptions?.scale ?? false
}

export function createExportTargetState(editor: Editor, selectedIds: ComputedRef<string[]>) {
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const activeTarget = computed<ExportPanelTarget>(() =>
    hasSelection.value ? 'selection' : 'page'
  )
  const targetIds = useSceneComputed(() =>
    selectedIds.value.length > 0 ? selectedIds.value : [editor.state.currentPageId]
  )

  const selectedNodeName = computed(() => {
    const ids = editor.state.selectedIds
    if (ids.size === 1) {
      const id = [...ids][0]
      return editor.graph.getNode(id)?.name ?? 'Export'
    }
    if (ids.size > 1) return `${ids.size} layers`
    return null
  })

  const currentPageName = computed(() => {
    const page = editor.graph.getNode(editor.state.currentPageId)
    return page?.name ?? 'Page'
  })

  const activeName = computed(() =>
    activeTarget.value === 'selection'
      ? (selectedNodeName.value ?? 'Export')
      : currentPageName.value
  )
  const activeSettings = useSceneComputed(() => {
    const firstId = targetIds.value[0]
    return firstId ? [...(editor.graph.getNode(firstId)?.exportSettings ?? [])] : []
  })
  const mixed = useSceneComputed(() => {
    const [firstId, ...otherIds] = targetIds.value
    if (!firstId || otherIds.length === 0) return false
    const first = editor.graph.getNode(firstId)?.exportSettings ?? []
    return otherIds.some((id) => {
      const settings = editor.graph.getNode(id)?.exportSettings ?? []
      return !exportSettingsEqual(first, settings)
    })
  })

  return {
    hasSelection,
    activeTarget,
    targetIds,
    selectedNodeName,
    currentPageName,
    activeName,
    activeSettings,
    mixed
  }
}

function exportSettingsEqual(a: ExportSetting[], b: ExportSetting[]) {
  if (a.length !== b.length) return false
  return a.every((setting, index) => {
    const other = b[index]
    return setting.scale === other.scale && setting.format === other.format
  })
}

function nextExportSetting(settings: ExportSetting[]): ExportSetting {
  const last = settings.at(-1)
  if (!last) return createDefaultExportSetting()
  // Each added row doubles the previous scale (1x → 2x → 4x …).
  return {
    scale: clampExportScale(last.scale * 2),
    format: last.format
  }
}

function syncExportSettingsPluginData(
  pluginData: PluginDataEntry[],
  settings: ExportSetting[]
): PluginDataEntry[] {
  const withoutExportSettings = pluginData.filter(
    (entry) =>
      !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === EXPORT_SETTINGS_PLUGIN_KEY)
  )
  if (settings.length === 0) return withoutExportSettings
  return [
    ...withoutExportSettings,
    {
      pluginId: OPEN_PENCIL_PLUGIN_ID,
      key: EXPORT_SETTINGS_PLUGIN_KEY,
      value: JSON.stringify(settings)
    }
  ]
}

function updateEveryTarget(
  editor: Editor,
  targetIds: ComputedRef<string[]>,
  label: string,
  update: (settings: ExportSetting[]) => ExportSetting[]
) {
  editor.undo.runBatch(label, () => {
    for (const id of targetIds.value) {
      const node = editor.graph.getNode(id)
      if (!node) continue
      const exportSettings = update(node.exportSettings)
      editor.updateNodeWithUndo(
        id,
        {
          exportSettings,
          pluginData: syncExportSettingsPluginData(node.pluginData, exportSettings)
        },
        label
      )
    }
  })
}

export function createExportSettingActions(editor: Editor, targetIds: ComputedRef<string[]>) {
  function addSetting() {
    updateEveryTarget(editor, targetIds, 'Add export setting', (settings) => [
      ...settings,
      nextExportSetting(settings)
    ])
  }

  function removeSetting(index: number) {
    updateEveryTarget(editor, targetIds, 'Remove export setting', (settings) =>
      settings.filter((_, i) => i !== index)
    )
  }

  function updateScale(index: number, scale: number) {
    updateEveryTarget(editor, targetIds, 'Update export scale', (settings) =>
      settings.map((setting, i) =>
        i === index ? { ...setting, scale: clampExportScale(scale) } : setting
      )
    )
  }

  function updateFormat(index: number, format: ExportFormatId) {
    updateEveryTarget(editor, targetIds, 'Update export format', (settings) =>
      settings.map((setting, i) => (i === index ? { ...setting, format } : setting))
    )
  }

  return {
    addSetting,
    removeSetting,
    updateScale,
    updateFormat,
    addSelectionSetting: addSetting,
    addPageSetting: addSetting,
    removeSelectionSetting: removeSetting,
    removePageSetting: removeSetting,
    updateSelectionScale: updateScale,
    updatePageScale: updateScale,
    updateSelectionFormat: updateFormat,
    updatePageFormat: updateFormat
  }
}
