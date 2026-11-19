import type {
  ColorProfile,
  Fill,
  SceneGraph,
  SceneNode,
  Variable,
  VariableAlias,
  VariableValue
} from '@open-pencil/scene-graph'
import { convertColor } from '@open-pencil/scene-graph/color'
import { copyEffects, copyFill, copyStyleRuns, copyStroke } from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { getPageBackgrounds, pageSourceWithBackgrounds } from '#core/figma-api/page-backgrounds'

import type { EditorContext } from './types'

/**
 * How a document takes another color profile, as Figma's File color profile dialog offers it:
 * `assign` keeps every stored number and reads it in the new profile, so colors change; `convert`
 * rewrites the numbers so colors look the same, mapping those the new profile cannot show to the
 * nearest it can.
 */
export type DocumentColorProfileMode = 'assign' | 'convert'

type PaintFields = Pick<
  SceneNode,
  'fills' | 'strokes' | 'effects' | 'styleRuns' | 'textDecorationFills'
>

/** What converting changes, before and after, so one undo step can put it back. */
interface ColorChanges {
  layers: Map<string, { before: PaintFields; after: PaintFields }>
  pages: Map<string, { before: SceneNode['source']; after: SceneNode['source'] }>
  variables: Map<string, { before: Variable['valuesByMode']; after: Variable['valuesByMode'] }>
}

/** `copy` of a paint, its color and gradient stops converted; a stroke keeps its geometry. */
function convertPaint<T extends Fill>(
  paint: T,
  copy: (paint: T) => T,
  convert: (color: Color) => Color
): T {
  const next = copy(paint)
  next.color = convert(paint.color)
  if (paint.gradientStops) {
    next.gradientStops = paint.gradientStops.map((stop) => ({
      ...stop,
      color: convert(stop.color)
    }))
  }
  return next
}

function convertFill(fill: Fill, convert: (color: Color) => Color): Fill {
  return convertPaint(fill, copyFill, convert)
}

function paintFields(node: SceneNode): PaintFields {
  return {
    fills: node.fills.map(copyFill),
    strokes: node.strokes.map(copyStroke),
    effects: copyEffects(node.effects),
    styleRuns: copyStyleRuns(node.styleRuns),
    textDecorationFills: node.textDecorationFills.map(copyFill)
  }
}

function convertedPaintFields(node: SceneNode, convert: (color: Color) => Color): PaintFields {
  const convertFills = (fills: Fill[]) => fills.map((fill) => convertFill(fill, convert))
  return {
    fills: convertFills(node.fills),
    strokes: node.strokes.map((stroke) => convertPaint(stroke, copyStroke, convert)),
    effects: copyEffects(node.effects).map((effect) => ({
      ...effect,
      color: convert(effect.color)
    })),
    styleRuns: copyStyleRuns(node.styleRuns).map((run) => ({
      ...run,
      style: {
        ...run.style,
        fills: run.style.fills && convertFills(run.style.fills),
        textDecorationFills:
          run.style.textDecorationFills && convertFills(run.style.textDecorationFills)
      }
    })),
    textDecorationFills: convertFills(node.textDecorationFills)
  }
}

function isColorValue(value: VariableValue | Color | VariableAlias): value is Color {
  return typeof value === 'object' && 'r' in value
}

/** A color variable's value with its literal colors converted, an expression's operand included. */
function convertVariableValue(
  value: VariableValue,
  convert: (color: Color) => Color
): VariableValue {
  if (isColorValue(value)) return convert(value)
  if (typeof value === 'object' && 'expression' in value && value.expression === 'COMPOSE_COLOR') {
    return isColorValue(value.color) ? { ...value, color: convert(value.color) } : value
  }
  return value
}

/** Every stored color in `graph` converted from `from` to `to`, before and after. */
function convertedColors(
  graph: SceneGraph,
  from: ColorProfile,
  to: ColorProfile
): ColorChanges {
  const convert = (color: Color) => convertColor(color, from, to, 'map')
  const changes: ColorChanges = { layers: new Map(), pages: new Map(), variables: new Map() }
  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') {
      const backgrounds = getPageBackgrounds(node).map((fill) => convertFill(fill, convert))
      changes.pages.set(node.id, {
        before: structuredClone(node.source),
        after: pageSourceWithBackgrounds(node, backgrounds)
      })
      continue
    }
    const { fills, strokes, effects, styleRuns, textDecorationFills } = node
    const paints = [fills, strokes, effects, styleRuns, textDecorationFills]
    if (paints.every((list) => list.length === 0)) continue
    changes.layers.set(node.id, {
      before: paintFields(node),
      after: convertedPaintFields(node, convert)
    })
  }
  for (const variable of graph.variables.values()) {
    if (variable.type !== 'COLOR') continue
    const before = structuredClone(variable.valuesByMode)
    const after = Object.fromEntries(
      Object.entries(before).map(([mode, value]) => [mode, convertVariableValue(value, convert)])
    )
    changes.variables.set(variable.id, { before, after })
  }
  return changes
}

function applyColorChanges(graph: SceneGraph, changes: ColorChanges, side: 'before' | 'after') {
  for (const [id, change] of changes.layers) {
    if (graph.getNode(id)) graph.updateNode(id, structuredClone(change[side]))
  }
  for (const [id, change] of changes.pages) {
    if (graph.getNode(id)) graph.updateNode(id, { source: structuredClone(change[side]) })
  }
  for (const [id, change] of changes.variables) {
    const variable = graph.variables.get(id)
    if (!variable) continue
    graph.willChangeVariable(id)
    variable.valuesByMode = structuredClone(change[side])
  }
}

export function createColorSpaceActions(ctx: EditorContext) {
  /**
   * Gives the document `colorSpace` as one undo step, assigning it or converting every stored
   * color into it: layers' paints, effects, and text runs, page backgrounds, and color variables.
   */
  function setDocumentColorSpace(
    colorSpace: ColorProfile,
    mode: DocumentColorProfileMode = 'assign'
  ) {
    const previous = ctx.graph.documentColorSpace
    if (previous === colorSpace) return
    const changes =
      mode === 'convert' ? convertedColors(ctx.graph, previous, colorSpace) : undefined

    const apply = (space: ColorProfile, side: 'before' | 'after') => {
      if (changes) applyColorChanges(ctx.graph, changes, side)
      ctx.graph.documentColorSpace = space
      // Assigning a profile changes how every stored colour draws without touching a node, so the
      // renderers' pictures and tiles are rebuilt rather than kept for the new generation.
      for (const renderer of ctx.getRenderers()) renderer.invalidateAllPictures()
      ctx.emitEditorEvent('document:color-space-changed', space)
      ctx.requestRender()
    }

    apply(colorSpace, 'after')
    ctx.undo.push({
      label: mode === 'convert' ? 'Convert color profile' : 'Assign color profile',
      forward: () => apply(colorSpace, 'after'),
      inverse: () => apply(previous, 'before')
    })
  }

  return {
    setDocumentColorSpace
  }
}
