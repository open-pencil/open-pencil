import { watchImmediate } from '@vueuse/core'
import { ref } from 'vue'

import { iconColor } from '@open-pencil/core/icons'
import { readIcon } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/** Headless state and actions for the selected icon: its name and its color. */
export function useIcon() {
  const editor = useEditor()
  const { selectedNode } = useSelectionState()
  const batch = useUndoBatch(editor.undo, editor.beginInteractiveEdit)

  const name = useSceneComputed(() => {
    const node = selectedNode.value
    return node ? (readIcon(node)?.name ?? null) : null
  })
  /** The color of the icon's tinted paths; null for an icon drawn only in its own colors. */
  const color = useSceneComputed(() => {
    const node = selectedNode.value
    return node && name.value ? iconColor(editor.graph, node) : null
  })

  /** The selected icon's SVG markup, for showing which icon it is. */
  const preview = ref<string | null>(null)
  /** The name of the set the icon comes from, such as Lucide, once the catalogue is in. */
  const setName = ref<string | null>(null)
  watchImmediate(name, async (current) => {
    if (!current) return
    const prefix = current.slice(0, current.indexOf(':'))
    const [drawn, sets] = await Promise.all([
      editor.iconProvider.previews([current]).catch(() => null),
      editor.iconProvider.collections().catch(() => [])
    ])
    if (name.value !== current) return
    preview.value = drawn?.get(current) ?? null
    setName.value = sets.find((info) => info.prefix === prefix)?.name ?? null
  })

  async function swap(next: string) {
    const node = selectedNode.value
    if (!node || !name.value || name.value === next) return
    batch.flush()
    await editor.swapIconGlyph(node.id, next)
  }

  // A drag in the open color picker sends many colors; they undo as one step, committed when
  // the picker closes. A color typed in while it is closed is a step of its own.
  let picking = false
  function setColorPicking(open: boolean) {
    picking = open
    if (!open) batch.flush()
  }

  function setColor(next: Color) {
    const node = selectedNode.value
    if (!node || !name.value) return
    if (picking) batch.ensure(`icon-color:${node.id}`, 'Change icon color')
    editor.setIconColor(node.id, next)
  }

  return { name, color, preview, setName, swap, setColor, setColorPicking }
}
