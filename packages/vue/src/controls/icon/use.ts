import { watchImmediate } from '@vueuse/core'
import { computed, ref } from 'vue'

import { iconColor } from '@open-pencil/core/icons'
import { isIconModified, readIcon } from '@open-pencil/scene-graph'
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
    // The last icon's preview never stands in for the next one while it loads.
    preview.value = null
    setName.value = null
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

  /** The selected icon's layer, so a question asked about it can be dropped if it changes. */
  const frameId = computed(() => (name.value ? (selectedNode.value?.id ?? null) : null))

  /** The icon's paths were edited since it was placed; see `isIconModified`. */
  const modified = useSceneComputed(() => {
    const node = selectedNode.value
    const frame = node && name.value ? editor.graph.getNode(node.id) : undefined
    return frame ? isIconModified(editor.graph, frame) : false
  })

  /** Draws the icon as it was placed, discarding edits to its paths. */
  async function reset() {
    const node = selectedNode.value
    if (!node || !name.value) return
    batch.flush()
    await editor.resetIcon(node.id)
  }

  /** Makes the icon plain artwork that keeps its paths. */
  function detach() {
    const node = selectedNode.value
    if (!node || !name.value) return
    batch.flush()
    editor.detachIcon(node.id)
  }

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

  return {
    frameId,
    name,
    color,
    preview,
    setName,
    modified,
    swap,
    reset,
    detach,
    setColor,
    setColorPicking
  }
}
