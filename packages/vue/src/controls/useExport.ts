import { ref } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core'
import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useSceneComputed } from '@open-pencil/vue/internal/useSceneComputed'

export type ExportFormatId = 'png' | 'jpg' | 'webp' | 'svg' | 'fig'

/**
 * Single export preset row managed by {@link useExport}.
 */
interface ExportSetting {
  scale: number
  format: ExportFormatId
}

const SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const
const FORMATS: ExportFormatId[] = ['png', 'jpg', 'webp', 'svg', 'fig']
const io = new IORegistry(BUILTIN_IO_FORMATS)

/**
 * Returns selection-aware export settings for export panel UIs.
 *
 * This composable manages export presets such as scale and format while also
 * exposing the current export target label derived from the selection.
 */
export function useExport() {
  const editor = useEditor()

  const settings = ref<ExportSetting[]>([{ scale: 1, format: 'png' }])

  const selectedIds = useSceneComputed(() => [...editor.state.selectedIds])

  const formatSupportsScale = (format: ExportFormatId) =>
    io.getFormat(format)?.exportOptions?.scale ?? false

  const nodeName = useSceneComputed(() => {
    const ids = editor.state.selectedIds
    if (ids.size === 1) {
      const id = [...ids][0]
      return editor.graph.getNode(id)?.name ?? 'Export'
    }
    return `${ids.size} layers`
  })

  function addSetting() {
    const last = settings.value[settings.value.length - 1]
    const nextScale = SCALES.find((s) => s > (last?.scale ?? 1)) ?? 2
    settings.value.push({ scale: nextScale, format: last?.format ?? 'png' })
  }

  function removeSetting(index: number) {
    settings.value.splice(index, 1)
  }

  function updateScale(index: number, scale: number) {
    settings.value[index] = { ...settings.value[index], scale }
  }

  function updateFormat(index: number, format: ExportFormatId) {
    settings.value[index] = { ...settings.value[index], format }
  }

  return {
    editor,
    settings,
    selectedIds,
    nodeName,
    scales: SCALES,
    formats: FORMATS,
    addSetting,
    removeSetting,
    updateScale,
    updateFormat,
    formatSupportsScale
  }
}
