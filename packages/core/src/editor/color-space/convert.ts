import type {
  Fill,
  SceneGraph,
  SceneNode,
  Variable,
  VariableAlias,
  VariableFormulaNode,
  VariableValue
} from '@open-pencil/scene-graph'
import {
  cloneVectorNetwork,
  copyEffects,
  copyFill,
  copyLayoutGrids,
  copyStyleRuns
} from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { getPageBackgrounds, pageSourceWithBackgrounds } from '#core/figma-api/page-backgrounds'
import { reconcileVariableLayouts } from '#core/layout/variables'

/** The node fields that hold colors, which {@link mapNodeColors} rewrites. */
type NodeColorFields = Pick<
  SceneNode,
  'fills' | 'strokes' | 'effects' | 'styleRuns' | 'textDecorationFills' | 'layoutGrids'
> &
  Partial<Pick<SceneNode, 'vectorNetwork'>>

/** A paint with its color and gradient stops passed through `map`; a stroke keeps its geometry. */
function mapPaintColors<T extends Fill>(paint: T, map: (color: Color) => Color): T {
  const next = copyFill(paint)
  next.color = map(paint.color)
  if (paint.gradientStops) {
    next.gradientStops = paint.gradientStops.map((stop) => ({ ...stop, color: map(stop.color) }))
  }
  return next
}

/**
 * Copies of every field of `node`, a layer or its saved color fields, that stores a color, each
 * color passed through `map`: fills, strokes, and their gradient stops, effects and a duotone
 * noise's second color, text runs and decoration paints, layout grids, and vector regions' own
 * fills. `null` when it stores no color. Converting a document's
 * colors to another profile walks them all here.
 */
function mapNodeColors(
  node: NodeColorFields,
  map: (color: Color) => Color
): NodeColorFields | null {
  const regions = node.vectorNetwork?.regions.some((region) => region.fills?.length)
  const holdsColors =
    regions ||
    [
      node.fills,
      node.strokes,
      node.effects,
      node.styleRuns,
      node.textDecorationFills,
      node.layoutGrids
    ].some((list) => list.length > 0)
  if (!holdsColors) return null
  const mapFills = (fills: Fill[]) => fills.map((fill) => mapPaintColors(fill, map))
  const fields: NodeColorFields = {
    fills: mapFills(node.fills),
    strokes: node.strokes.map((stroke) => mapPaintColors(stroke, map)),
    effects: copyEffects(node.effects).map((effect) => {
      const next = { ...effect, color: map(effect.color) }
      if (effect.noise?.secondaryColor) {
        next.noise = { ...effect.noise, secondaryColor: map(effect.noise.secondaryColor) }
      }
      return next
    }),
    styleRuns: copyStyleRuns(node.styleRuns).map((run) => ({
      ...run,
      style: {
        ...run.style,
        fills: run.style.fills && mapFills(run.style.fills),
        textDecorationFills:
          run.style.textDecorationFills && mapFills(run.style.textDecorationFills)
      }
    })),
    textDecorationFills: mapFills(node.textDecorationFills),
    layoutGrids: copyLayoutGrids(node.layoutGrids).map((grid) =>
      grid.color ? { ...grid, color: map(grid.color) } : grid
    )
  }
  if (node.vectorNetwork && regions) {
    const network = cloneVectorNetwork(node.vectorNetwork)
    network.regions = network.regions.map((region) =>
      region.fills ? { ...region, fills: mapFills(region.fills) } : region
    )
    fields.vectorNetwork = network
  }
  return fields
}

export type ConvertColor = (color: Color) => Color

/**
 * The stored colors a conversion changes, as they were before it: redoing converts them again,
 * since converting is deterministic, so only one copy of each is kept.
 */
export interface ColorsBefore {
  layers: Map<string, NodeColorFields>
  pages: Map<string, SceneNode['source']>
  variables: Map<string, Variable['valuesByMode']>
}

function isColorValue(value: VariableValue | VariableFormulaNode): value is Color {
  return typeof value === 'object' && 'r' in value
}

function isAlias(value: VariableFormulaNode): value is VariableAlias {
  return typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS'
}

/** A formula's literal colors converted, its aliases and other operands as they were. */
function convertFormulaNode(node: VariableFormulaNode, convert: ConvertColor): VariableFormulaNode {
  if (isColorValue(node)) return convert(node)
  if (typeof node !== 'object' || isAlias(node)) return node
  return { ...node, operands: node.operands.map((operand) => convertFormulaNode(operand, convert)) }
}

/** A color variable's value with its literal colors converted, inside expressions too. */
function convertVariableValue(value: VariableValue, convert: ConvertColor): VariableValue {
  if (isColorValue(value)) return convert(value)
  if (typeof value !== 'object' || !('expression' in value)) return value
  if (value.expression === 'COMPOSE_COLOR') {
    return isColorValue(value.color) ? { ...value, color: convert(value.color) } : value
  }
  if (value.expression === 'FORMULA') {
    return { ...value, value: convertFormulaNode(value.value, convert) }
  }
  return value
}

/** Every stored color in `graph` as it is now: layers' color fields, pages, and color variables. */
export function colorsBefore(graph: SceneGraph): ColorsBefore {
  const before: ColorsBefore = { layers: new Map(), pages: new Map(), variables: new Map() }
  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') {
      before.pages.set(node.id, structuredClone(node.source))
      continue
    }
    const fields = mapNodeColors(node, (color) => ({ ...color }))
    if (fields) before.layers.set(node.id, fields)
  }
  for (const variable of graph.variables.values()) {
    if (variable.type === 'COLOR') {
      before.variables.set(variable.id, structuredClone(variable.valuesByMode))
    }
  }
  return before
}

/** Writes the colors in `before`, converted through `convert` when given, back into `graph`. */
export function writeColors(graph: SceneGraph, before: ColorsBefore, convert: ConvertColor | null) {
  for (const [id, fields] of before.layers) {
    if (!graph.getNode(id)) continue
    graph.updateNode(id, mapNodeColors(fields, convert ?? ((color) => ({ ...color }))) ?? {})
  }
  for (const [id, source] of before.pages) {
    const page = graph.getNode(id)
    if (!page) continue
    if (!convert) {
      graph.updateNode(id, { source: structuredClone(source) })
      continue
    }
    const backgrounds = getPageBackgrounds({ ...page, source }).map((fill) =>
      mapPaintColors(fill, convert)
    )
    graph.updateNode(id, { source: pageSourceWithBackgrounds({ ...page, source }, backgrounds) })
  }
  for (const [id, values] of before.variables) {
    const variable = graph.variables.get(id)
    if (!variable) continue
    graph.willChangeVariable(id)
    variable.valuesByMode = convert
      ? Object.fromEntries(
          Object.entries(values).map(([mode, value]) => [
            mode,
            convertVariableValue(value, convert)
          ])
        )
      : structuredClone(values)
  }
  reconcileVariableLayouts(graph, { variables: [...before.variables.keys()] })
}
