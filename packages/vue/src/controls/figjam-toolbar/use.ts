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
 * Which of FigJam's selection toolbars a selection gets: one per kind of layer, a text toolbar for
 * text with sticky notes, and only arranging for any other mix.
 */
export type FigJamToolbarKind =
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'text'
  | 'section'
  | 'group'
  | 'image'
  | 'layer'
  | 'mixed'

/** Layers FigJam's colour menu paints as plain layers: one colour as fill, and for most a stroke. */
const PLAIN_LAYERS: ReadonlySet<SceneNode['type']> = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'POLYGON',
  'STAR',
  'LINE',
  'VECTOR',
  'FRAME',
  'BOOLEAN_OPERATION'
])

const KIND_BY_TYPE: Partial<Record<SceneNode['type'], FigJamToolbarKind>> = {
  STICKY: 'sticky',
  SHAPE_WITH_TEXT: 'shape',
  CONNECTOR: 'connector',
  TEXT: 'text',
  SECTION: 'section',
  GROUP: 'group'
}

function layerKind(node: SceneNode): FigJamToolbarKind {
  if (node.fills.some((fill) => fill.type === 'IMAGE')) return 'image'
  if (PLAIN_LAYERS.has(node.type)) return 'layer'
  return KIND_BY_TYPE[node.type] ?? 'mixed'
}

/** The toolbar a selection gets, as FigJam picks it. */
function toolbarKind(layers: SceneNode[]): FigJamToolbarKind | null {
  const kinds = new Set(layers.map(layerKind))
  if (kinds.size === 0) return null
  if (kinds.size === 1) return [...kinds][0] ?? null
  // Text and sticky notes share their text menus; any other mix only arranges.
  return [...kinds].every((kind) => kind === 'text' || kind === 'sticky') ? 'text' : 'mixed'
}

/**
 * Headless state and actions for FigJam's selection toolbar: which toolbar the selection gets,
 * and the colour, outline and text menus of the layers without a toolbar of their own. Sticky
 * notes, shapes with text and connectors keep their own composables for the rest.
 */
export function useFigJamToolbar() {
  const editor = useEditor()
  const { selectedIds } = useSelectionState()

  const layers = useSceneComputed(() =>
    [...selectedIds.value].flatMap((id) => {
      const node = editor.graph.getNode(id)
      return node ? [node] : []
    })
  )
  const ids = computed(() => layers.value.map((layer) => layer.id))
  const kind = computed(() => toolbarKind(layers.value))
  /** Whether several layers are selected, which adds FigJam's arranging menus. */
  const several = computed(() => layers.value.length > 1)

  const style = useSceneComputed(() => {
    const first = layers.value.at(0)
    if (!first) return null
    const text = first.type === 'TEXT' ? first : generatedFrameText(editor.graph, first)
    return {
      color: first.type === 'SECTION' ? figJamSectionColorName(first) : figJamLayerColorName(first),
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

  function idsOf(type: SceneNode['type']) {
    return layers.value.filter((layer) => layer.type === type).map((layer) => layer.id)
  }

  function setColor(name: FigJamColorName) {
    editor.setFigJamColor(ids.value, name)
  }

  function setLineStyle(value: FigJamLineStyle) {
    editor.setSectionLineStyle(ids.value, value)
  }

  function setLineColor(name: FigJamColorName) {
    editor.setSectionLineColor(ids.value, name)
  }

  /** Sets the text of every selected layer to one of FigJam's sizes, each as its kind sizes it. */
  function setTextSize(size: FigJamTextSize) {
    editor.undo.runBatch('Change text size', () => {
      editor.setFigJamTextSize(idsOf('TEXT'), size)
      editor.setStickyTextSize(idsOf('STICKY'), size)
      editor.setShapesWithTextTextSize(idsOf('SHAPE_WITH_TEXT'), size)
    })
  }

  function setTypeface(value: FigJamTypeface) {
    return editor.setFigJamTypeface(ids.value, value)
  }

  function wrapInSection() {
    editor.wrapSelectionInSection()
  }

  function align(axis: 'horizontal' | 'vertical', to: 'min' | 'center' | 'max') {
    editor.alignNodes(ids.value, axis, to)
  }

  return {
    layers,
    kind,
    several,
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
    setTypeface,
    wrapInSection,
    align
  }
}
