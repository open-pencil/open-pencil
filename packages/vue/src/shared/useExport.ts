import { ref } from 'vue'

import { useEditor } from './editorContext'
import { useSceneComputed } from './useSceneComputed'

import type { ExportFormat } from '@open-pencil/core'

interface ExportSetting {
  scale: number
  format: ExportFormat
}

const SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const
const FORMATS: ExportFormat[] = ['PNG', 'JPG', 'WEBP', 'SVG']

export function useExport() {
  const editor = useEditor()

  const settings = ref<ExportSetting[]>([{ scale: 1, format: 'PNG' }])

  const selectedIds = useSceneComputed(() => [...editor.state.selectedIds])

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
    settings.value.push({ scale: nextScale, format: last?.format ?? 'PNG' })
  }

  function removeSetting(index: number) {
    settings.value.splice(index, 1)
  }

  function updateScale(index: number, scale: number) {
    settings.value[index] = { ...settings.value[index], scale }
  }

  function updateFormat(index: number, format: ExportFormat) {
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
    updateFormat
  }
}
