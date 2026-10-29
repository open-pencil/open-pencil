import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamColorName,
  figJamFillMode,
  figJamLineStyle,
  figJamTextSize,
  figJamTypeface,
  type FigJamColorName,
  type FigJamFillMode,
  type FigJamLineStyle,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Headless state and actions for shapes with text: the kind the shape tool places, and the kind,
 * colours, outline and text of the selected shapes, as FigJam's selection toolbar sets them. A
 * selection of several shapes reads its first shape and changes them all.
 */
export function useShapeWithText() {
  const editor = useEditor()
  const { selectedIds } = useSelectionState()

  const shapes = useSceneComputed(() => {
    const nodes = [...selectedIds.value].map((id) => editor.graph.getNode(id))
    return nodes.length > 0 && nodes.every((node) => node?.type === 'SHAPE_WITH_TEXT')
      ? nodes.filter((node): node is SceneNode => node !== undefined)
      : []
  })
  const ids = computed(() => shapes.value.map((shape) => shape.id))
  // Read from the scene each time it changes: a shape is edited in place, so a computed holding
  // the node itself would never see its colour or text change.
  const style = useSceneComputed(() => {
    const first = shapes.value.at(0)
    if (!first) return null
    const label = shapeWithTextLabel(editor.graph, first)
    return {
      kind: first.shapeWithTextType,
      color: figJamColorName(first.fills.at(0)?.color),
      fillMode: figJamFillMode(first.fills.at(0)),
      lineStyle: figJamLineStyle(first),
      lineColor: figJamColorName(first.strokes.at(0)?.color),
      textSize: label ? figJamTextSize(label) : null,
      typeface: label ? figJamTypeface(label) : null,
      labelFont: label?.fontFamily ?? null
    }
  })

  const active = computed(() => shapes.value.length > 0)
  const kind = computed<ShapeWithTextType | null>(() => style.value?.kind ?? null)
  const color = computed<FigJamColorName | null>(() => style.value?.color ?? null)
  const fillMode = computed<FigJamFillMode | null>(() => style.value?.fillMode ?? null)
  const lineStyle = computed<FigJamLineStyle | null>(() => style.value?.lineStyle ?? null)
  const lineColor = computed<FigJamColorName | null>(() => style.value?.lineColor ?? null)
  const textSize = computed<FigJamTextSize | null>(() => style.value?.textSize ?? null)
  const typeface = computed<FigJamTypeface | null>(() => style.value?.typeface ?? null)
  /** The label's font family, which names a face FigJam's typeface menu does not offer. */
  const labelFont = computed(() => style.value?.labelFont ?? null)
  const toolKind = computed(() => editor.state.shapeWithTextKind)
  const toolActive = computed(() => editor.state.activeTool === 'SHAPE_WITH_TEXT')

  /** Turns the selected shapes into `value`, keeping their size. */
  function setKind(value: ShapeWithTextType) {
    editor.changeShapesWithTextKind(ids.value, value)
  }

  function setColor(value: FigJamColorName) {
    editor.setShapesWithTextColor(ids.value, value)
  }

  function setFillMode(value: FigJamFillMode) {
    editor.setShapesWithTextFillMode(ids.value, value)
  }

  function setLineStyle(value: FigJamLineStyle) {
    editor.setShapesWithTextLineStyle(ids.value, value)
  }

  function setLineColor(value: FigJamColorName) {
    editor.setShapesWithTextLineColor(ids.value, value)
  }

  function setTextSize(value: FigJamTextSize) {
    editor.setShapesWithTextTextSize(ids.value, value)
  }

  function setTypeface(value: FigJamTypeface) {
    return editor.setGeneratedTextTypeface(ids.value, value)
  }

  /** Picks `value` for the shape tool and arms it, as FigJam's Shapes panel does. */
  function drawKind(value: ShapeWithTextType) {
    editor.setShapeWithTextKind(value)
    editor.setTool('SHAPE_WITH_TEXT')
  }

  return {
    active,
    kind,
    color,
    fillMode,
    lineStyle,
    lineColor,
    textSize,
    typeface,
    labelFont,
    toolKind,
    toolActive,
    setKind,
    setColor,
    setFillMode,
    setLineStyle,
    setLineColor,
    setTextSize,
    setTypeface,
    drawKind
  }
}
