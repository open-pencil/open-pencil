import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamTextSize,
  figJamTypeface,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { stickySublayers } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Headless state and actions for selected sticky notes: their colour, text size, and whether
 * they show their author. A selection of several notes reads its first note and edits them all.
 */
export function useStickyNote() {
  const editor = useEditor()
  const { selectedIds } = useSelectionState()

  const stickies = useSceneComputed(() => {
    const nodes = [...selectedIds.value].map((id) => editor.graph.getNode(id))
    return nodes.length > 0 && nodes.every((node) => node?.type === 'STICKY')
      ? nodes.filter((node): node is SceneNode => node !== undefined)
      : []
  })
  const active = computed(() => stickies.value.length > 0)
  const ids = computed(() => stickies.value.map((sticky) => sticky.id))
  const sublayers = useSceneComputed(() => {
    const first = stickies.value.at(0)
    return first ? stickySublayers(editor.graph, first) : null
  })

  const color = computed<Color | null>(() => stickies.value.at(0)?.fills.at(0)?.color ?? null)
  const textSize = computed<FigJamTextSize | null>(() =>
    sublayers.value ? figJamTextSize(sublayers.value.body) : null
  )
  const authorVisible = computed(() => sublayers.value?.author.visible ?? false)
  /** The body's font family, which names a face FigJam's typeface menu does not offer. */
  const bodyFont = computed(() => sublayers.value?.body.fontFamily ?? null)
  const typeface = computed<FigJamTypeface | null>(() =>
    sublayers.value ? figJamTypeface(sublayers.value.body) : null
  )

  function setColor(value: Color) {
    editor.setStickyColor(ids.value, value)
  }

  function setTextSize(value: FigJamTextSize) {
    editor.setStickyTextSize(ids.value, value)
  }

  function setAuthorVisible(value: boolean) {
    editor.setStickyAuthorVisible(ids.value, value)
  }

  function setTypeface(value: FigJamTypeface) {
    return editor.setGeneratedTextTypeface(ids.value, value)
  }

  return {
    active,
    color,
    textSize,
    authorVisible,
    typeface,
    bodyFont,
    setColor,
    setTextSize,
    setAuthorVisible,
    setTypeface
  }
}
