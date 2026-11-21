import { isEqual } from 'es-toolkit'

import type {
  Fill,
  SceneGraph,
  SceneNode,
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

/** Maps the color at `slot`, a stable name for where its owner stores it, such as `fills.0.stops.1`. */
type MapColor = (color: Color, slot: string) => Color

/** A paint with its color and gradient stops passed through `map`; a stroke keeps its geometry. */
function mapPaintColors<T extends Fill>(paint: T, map: MapColor, slot: string): T {
  const next = copyFill(paint)
  next.color = map(paint.color, slot)
  if (paint.gradientStops) {
    next.gradientStops = paint.gradientStops.map((stop, index) => ({
      ...stop,
      color: map(stop.color, `${slot}.stops.${index}`)
    }))
  }
  return next
}

function mapFills(fills: readonly Fill[], map: MapColor, slot: string): Fill[] {
  return fills.map((fill, index) => mapPaintColors(fill, map, `${slot}.${index}`))
}

/**
 * Copies of every field of `node` that stores a color, each color passed through `map`: fills,
 * strokes, and their gradient stops, effects and a duotone noise's second color, text runs and
 * decoration paints, layout grids, and vector regions' own fills. `null` when it stores no color.
 * Everything else in those fields, such as a vector's vertices, is copied as it is.
 */
function mapNodeColors(node: NodeColorFields, map: MapColor): NodeColorFields | null {
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
  const fields: NodeColorFields = {
    fills: mapFills(node.fills, map, 'fills'),
    strokes: node.strokes.map((stroke, index) => mapPaintColors(stroke, map, `strokes.${index}`)),
    effects: copyEffects(node.effects).map((effect, index) => {
      const next = { ...effect, color: map(effect.color, `effects.${index}`) }
      if (effect.noise?.secondaryColor) {
        next.noise = {
          ...effect.noise,
          secondaryColor: map(effect.noise.secondaryColor, `effects.${index}.noise`)
        }
      }
      return next
    }),
    styleRuns: copyStyleRuns(node.styleRuns).map((run, index) => ({
      ...run,
      style: {
        ...run.style,
        fills: run.style.fills && mapFills(run.style.fills, map, `runs.${index}.fills`),
        textDecorationFills:
          run.style.textDecorationFills &&
          mapFills(run.style.textDecorationFills, map, `runs.${index}.decoration`)
      }
    })),
    textDecorationFills: mapFills(node.textDecorationFills, map, 'decoration'),
    layoutGrids: copyLayoutGrids(node.layoutGrids).map((grid, index) =>
      grid.color ? { ...grid, color: map(grid.color, `grids.${index}`) } : grid
    )
  }
  if (node.vectorNetwork && regions) {
    const network = cloneVectorNetwork(node.vectorNetwork)
    network.regions = network.regions.map((region, index) =>
      region.fills ? { ...region, fills: mapFills(region.fills, map, `regions.${index}`) } : region
    )
    fields.vectorNetwork = network
  }
  return fields
}

function isColorValue(value: VariableValue | VariableFormulaNode): value is Color {
  return typeof value === 'object' && 'r' in value
}

function isAlias(value: VariableFormulaNode): value is VariableAlias {
  return typeof value === 'object' && 'aliasId' in value
}

/** A formula's literal colors mapped, its aliases and other operands as they were. */
function mapFormulaNode(
  node: VariableFormulaNode,
  map: MapColor,
  slot: string
): VariableFormulaNode {
  if (isColorValue(node)) return map(node, slot)
  if (typeof node !== 'object' || isAlias(node)) return node
  return {
    ...node,
    operands: node.operands.map((operand, index) =>
      mapFormulaNode(operand, map, `${slot}.${index}`)
    )
  }
}

/** A color variable's value with its literal colors mapped, inside expressions too. */
function mapVariableValue(value: VariableValue, map: MapColor, slot: string): VariableValue {
  if (isColorValue(value)) return map(value, slot)
  if (typeof value !== 'object' || !('expression' in value)) return value
  if (value.expression === 'COMPOSE_COLOR') {
    return isColorValue(value.color) ? { ...value, color: map(value.color, slot) } : value
  }
  if (value.expression === 'FORMULA') {
    return { ...value, value: mapFormulaNode(value.value, map, slot) }
  }
  return value
}

function mapVariableValues(graph: SceneGraph, id: string, map: MapColor): void {
  const variable = graph.variables.get(id)
  if (!variable) return
  graph.willChangeVariable(id)
  variable.valuesByMode = Object.fromEntries(
    Object.entries(variable.valuesByMode).map(([mode, value]) => [
      mode,
      mapVariableValue(value, map, mode)
    ])
  )
}

/** The colors a conversion rewrote in one layer, page, or variable, by slot. */
type ColorChanges = Map<string, { from: Color; to: Color }>

interface PageConversion {
  before: SceneNode['source']
  after: SceneNode['source']
  colors: ColorChanges
}

/**
 * What a conversion rewrote: each color it changed, by owner and slot, and each page's source
 * before and after. Undoing and redoing swap only colors that still hold the value the other
 * side left, so edits made since, to those colors or to anything else, are kept.
 */
export interface ColorConversion {
  layers: Map<string, ColorChanges>
  pages: Map<string, PageConversion>
  variables: Map<string, ColorChanges>
}

function sameColor(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a
}

function recording(convert: (color: Color) => Color, changes: ColorChanges): MapColor {
  return (color, slot) => {
    const next = convert(color)
    if (!sameColor(color, next)) changes.set(slot, { from: { ...color }, to: { ...next } })
    return next
  }
}

function swapping(changes: ColorChanges, redo: boolean): MapColor {
  return (color, slot) => {
    const change = changes.get(slot)
    if (!change) return color
    const [expected, next] = redo ? [change.from, change.to] : [change.to, change.from]
    return sameColor(color, expected) ? { ...next } : color
  }
}

/**
 * Rewrites every stored color in `graph` through `convert`: layers' color fields, page
 * backgrounds, and color variables. Returns what it changed, for {@link replayConversion}.
 */
export function convertColors(
  graph: SceneGraph,
  convert: (color: Color) => Color
): ColorConversion {
  const conversion: ColorConversion = { layers: new Map(), pages: new Map(), variables: new Map() }
  for (const node of graph.getAllNodes()) {
    const changes: ColorChanges = new Map()
    const map = recording(convert, changes)
    if (node.type === 'CANVAS') {
      const backgrounds = mapFills(getPageBackgrounds(node), map, 'backgrounds')
      if (changes.size === 0) continue
      const before = structuredClone(node.source)
      const after = pageSourceWithBackgrounds(node, backgrounds)
      graph.updateNode(node.id, { source: after })
      conversion.pages.set(node.id, { before, after: structuredClone(after), colors: changes })
      continue
    }
    const fields = mapNodeColors(node, map)
    if (!fields || changes.size === 0) continue
    graph.updateNode(node.id, fields)
    conversion.layers.set(node.id, changes)
  }
  for (const variable of graph.variables.values()) {
    if (variable.type !== 'COLOR') continue
    const changes: ColorChanges = new Map()
    mapVariableValues(graph, variable.id, recording(convert, changes))
    if (changes.size > 0) conversion.variables.set(variable.id, changes)
  }
  reconcileVariableLayouts(graph, { variables: [...conversion.variables.keys()] })
  return conversion
}

/**
 * Undoes `conversion`, or redoes it when `redo` is set. A page untouched since gets its whole
 * source from the other side; everywhere else only colors still at the value it left swap.
 */
export function replayConversion(graph: SceneGraph, conversion: ColorConversion, redo: boolean) {
  for (const [id, changes] of conversion.layers) {
    const node = graph.getNode(id)
    const fields = node && mapNodeColors(node, swapping(changes, redo))
    if (fields) graph.updateNode(id, fields)
  }
  for (const [id, { before, after, colors }] of conversion.pages) {
    const page = graph.getNode(id)
    if (!page) continue
    const [expected, target] = redo ? [before, after] : [after, before]
    if (isEqual(page.source, expected)) {
      graph.updateNode(id, { source: structuredClone(target) })
      continue
    }
    const backgrounds = mapFills(getPageBackgrounds(page), swapping(colors, redo), 'backgrounds')
    graph.updateNode(id, { source: pageSourceWithBackgrounds(page, backgrounds) })
  }
  for (const [id, changes] of conversion.variables) {
    mapVariableValues(graph, id, swapping(changes, redo))
  }
  reconcileVariableLayouts(graph, { variables: [...conversion.variables.keys()] })
}
