import { uniq } from 'es-toolkit'
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamColorName,
  figJamLayerColorName,
  figJamLineStyle,
  figJamSectionColorName,
  figJamTextSize,
  figJamTypeface,
  type FigJamColorName,
  type FigJamLineStyle,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'

import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Headless state and actions for FigJam's colour and line menus on layers without controls of
 * their own (text, sections, and plain shapes, lines, frames and groups), and its typeface and
 * size menus on any text, a sticky note's or shape's included. Sticky notes, shapes with text and
 * connectors keep their colours in `useStickyNote`, `useShapeWithText` and `useConnector`. A
 * selection of several reads its first layer and changes them all.
 */
export function useFigJamStyle() {
  const editor = useEditor()
  const { selectedIds } = useSelectionState()

  const layers = useSceneComputed(() =>
    [...selectedIds.value].flatMap((id) => {
      const node = editor.graph.getNode(id)
      return node ? [node] : []
    })
  )
  const ids = computed(() => layers.value.map((layer) => layer.id))

  /** The layers a group's colour is read from: its contents, as its colour paints them. */
  function painted(layer: SceneNode): SceneNode[] {
    if (layer.type !== 'GROUP') return [layer]
    return editor.graph.getChildren(layer.id).flatMap(painted)
  }

  /** The palette colour a layer shows, a group's when its contents share one. */
  function layerColor(layer: SceneNode): FigJamColorName | null {
    if (layer.type === 'SECTION') return figJamSectionColorName(layer)
    const names = uniq(painted(layer).map(figJamLayerColorName))
    return names.length === 1 ? (names[0] ?? null) : null
  }

  const style = useSceneComputed(() => {
    const first: SceneNode | undefined = layers.value.at(0)
    if (!first) return null
    const text = first.type === 'TEXT' ? first : generatedFrameText(editor.graph, first)
    return {
      color: layerColor(first),
      lineStyle: figJamLineStyle(first),
      lineColor: figJamColorName(first.strokes.at(0)?.color),
      textSize: text ? figJamTextSize(text) : null,
      typeface: text ? figJamTypeface(text) : null,
      font: text?.fontFamily ?? null
    }
  })
  const color = computed<FigJamColorName | null>(() => style.value?.color ?? null)
  const lineStyle = computed<FigJamLineStyle | null>(() => style.value?.lineStyle ?? null)
  const lineColor = computed<FigJamColorName | null>(() => style.value?.lineColor ?? null)
  const textSize = computed<FigJamTextSize | null>(() => style.value?.textSize ?? null)
  const typeface = computed<FigJamTypeface | null>(() => style.value?.typeface ?? null)
  /** The text's font family, which names a face FigJam's typeface menu does not offer. */
  const font = computed(() => style.value?.font ?? null)

  /** Paints the selected layers in a palette colour: sections in its tint, others in the colour. */
  function setColor(name: FigJamColorName) {
    editor.setFigJamColor(ids.value, name)
  }

  function setLineStyle(value: FigJamLineStyle) {
    editor.setSectionLineStyle(ids.value, value)
  }

  function setLineColor(name: FigJamColorName) {
    editor.setSectionLineColor(ids.value, name)
  }

  /** Sets the selected text, and sticky notes and shapes among it, to one of FigJam's sizes. */
  function setTextSize(size: FigJamTextSize) {
    editor.setFigJamTextSize(ids.value, size)
  }

  function setTypeface(value: FigJamTypeface) {
    return editor.setFigJamTypeface(ids.value, value)
  }

  return {
    color,
    lineStyle,
    lineColor,
    textSize,
    typeface,
    font,
    setColor,
    setLineStyle,
    setLineColor,
    setTextSize,
    setTypeface
  }
}
