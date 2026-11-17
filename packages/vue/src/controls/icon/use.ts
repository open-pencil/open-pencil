import { watchImmediate } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { iconColor, iconOptionApplies, type IconCollection } from '@open-pencil/core/icons'
import { isIconModified, readIcon, type IconOptions } from '@open-pencil/scene-graph/icons'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useEditor } from '#vue/editor/context'
import { useEditorEvent } from '#vue/editor/events/use'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Headless state and actions for the selected icon: its name, its color, and how its set draws it,
 * such as a Material Symbol's weight or an SF Symbol's rendering.
 */
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
  /** The set the icon comes from, once the catalogue is in. */
  const collection = shallowRef<IconCollection | null>(null)
  /** The name of the set the icon comes from, such as Lucide, once the catalogue is in. */
  const setName = computed(() => collection.value?.name ?? null)
  watchImmediate(name, async (current) => {
    // The last icon's preview never stands in for the next one while it loads.
    preview.value = null
    collection.value = null
    if (!current) return
    const prefix = current.slice(0, current.indexOf(':'))
    const [drawn, sets] = await Promise.all([
      editor.iconProvider.previews([current]).catch(() => null),
      editor.iconProvider.collections().catch(() => [])
    ])
    if (name.value !== current) return
    preview.value = drawn?.get(current) ?? null
    collection.value = sets.find((info) => info.prefix === prefix) ?? null
  })

  /** How the icon is drawn, as its set's options recorded it; empty for an Iconify icon. */
  const options = useSceneComputed((): IconOptions => {
    const node = selectedNode.value
    if (!node || !name.value) return {}
    return readIcon(node)?.options ?? {}
  })

  /** Why this host cannot draw the icon's set again, such as SF Symbols outside the Mac app. */
  const unavailable = computed(() => collection.value?.unavailable ?? null)

  /** The options the icon's set offers that apply to it as it is drawn. */
  const controls = computed(() =>
    (collection.value?.options ?? []).filter((option) => iconOptionApplies(option, options.value))
  )

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

  /**
   * The option values asked for and not yet drawn, by icon and key, so a value is compared with
   * the last one asked for rather than the one an icon still loading was drawn with. Each request
   * owns its entry by a token, so an earlier request of the same value finishing leaves it.
   */
  const requested = new Map<string, { value: IconOptions[string]; token: symbol }>()
  // Another document's icons may share these IDs.
  useEditorEvent('graph:replaced', () => requested.clear())

  async function swap(next: string) {
    const node = selectedNode.value
    if (!node || !name.value || name.value === next) return
    // A swap to another set draws with that set's defaults, so values asked for before it no
    // longer say what the icon will be drawn with.
    for (const id of requested.keys()) if (id.startsWith(`${node.id}/`)) requested.delete(id)
    batch.flush()
    await editor.swapIconGlyph(node.id, next)
  }

  /** Draws the icon afresh with the option `key` set to `value`, as one undo step. */
  async function setOption(key: string, value: IconOptions[string]) {
    const node = selectedNode.value
    if (!node || !name.value) return
    const id = `${node.id}/${key}`
    const pending = requested.get(id)
    const current = pending ? pending.value : options.value[key]
    if (current === value) return
    const token = Symbol(id)
    requested.set(id, { value, token })
    batch.flush()
    try {
      await editor.setIconOptions(node.id, { [key]: value })
    } finally {
      if (requested.get(id)?.token === token) requested.delete(id)
    }
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
    options,
    controls,
    unavailable,
    setOption,
    modified,
    swap,
    reset,
    detach,
    setColor,
    setColorPicking
  }
}
