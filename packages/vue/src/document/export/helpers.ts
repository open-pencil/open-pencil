import { computed } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

import type { ExportFormatId, ExportPanelTarget, ExportSetting } from '#vue/document/export/use'
import type { Editor } from '@open-pencil/core/editor'
import type { Ref } from 'vue'

export const EXPORT_SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const
export const EXPORT_FORMATS: ExportFormatId[] = ['png', 'jpg', 'webp', 'svg', 'fig']

const io = new IORegistry(BUILTIN_IO_FORMATS)

export function createDefaultExportSetting(): ExportSetting {
  return { scale: 1, format: 'png' }
}

export function formatSupportsScale(format: ExportFormatId) {
  return io.getFormat(format)?.exportOptions?.scale ?? false
}

export function createExportTargetState(
  editor: Editor,
  selectedIds: Ref<string[]>,
  selectionSettings: Ref<ExportSetting[]>,
  pageSettings: Ref<ExportSetting[]>
) {
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const activeTarget = computed<ExportPanelTarget>(() =>
    hasSelection.value ? 'selection' : 'page'
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
  const activeSettings = computed(() =>
    activeTarget.value === 'selection' ? selectionSettings.value : pageSettings.value
  )

  return {
    hasSelection,
    activeTarget,
    selectedNodeName,
    currentPageName,
    activeName,
    activeSettings
  }
}

export function createExportSettingActions(
  selectionSettings: Ref<ExportSetting[]>,
  pageSettings: Ref<ExportSetting[]>
) {
  function addSetting(settings: Ref<ExportSetting[]>) {
    const last = settings.value[settings.value.length - 1]
    const nextScale = EXPORT_SCALES.find((s) => s > last.scale) ?? 2
    settings.value.push({ scale: nextScale, format: last.format })
  }

  function updateScale(settings: Ref<ExportSetting[]>, index: number, scale: number) {
    settings.value[index] = { ...settings.value[index], scale }
  }

  function updateFormat(settings: Ref<ExportSetting[]>, index: number, format: ExportFormatId) {
    settings.value[index] = { ...settings.value[index], format }
  }

  return {
    addSelectionSetting: () => addSetting(selectionSettings),
    addPageSetting: () => addSetting(pageSettings),
    removeSelectionSetting: (index: number) => selectionSettings.value.splice(index, 1),
    removePageSetting: (index: number) => pageSettings.value.splice(index, 1),
    updateSelectionScale: (index: number, scale: number) =>
      updateScale(selectionSettings, index, scale),
    updatePageScale: (index: number, scale: number) => updateScale(pageSettings, index, scale),
    updateSelectionFormat: (index: number, format: ExportFormatId) =>
      updateFormat(selectionSettings, index, format),
    updatePageFormat: (index: number, format: ExportFormatId) =>
      updateFormat(pageSettings, index, format)
  }
}
