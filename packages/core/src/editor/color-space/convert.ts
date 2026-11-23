import { isEqual, pick } from 'es-toolkit'

import type {
  Fill,
  SceneGraph,
  SceneNode,
  Variable,
  VariableFormulaNode,
  VariableValue
} from '@open-pencil/scene-graph'
import {
  cloneVectorNetwork,
  copyEffects,
  copyFill,
  copyStroke,
  copyLayoutGrids,
  copyStyleRuns
} from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'
import {
  foldFormula,
  hasBoundPaints,
  layersUsingVariables,
  paintBindingTarget,
  recordWrittenBoundPaints,
  variableValueReferences
} from '@open-pencil/scene-graph/variables'

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

/**
 * A formula's literal colors mapped, its aliases and other operands as they were. Literals are
 * named by their order in the formula, which a formula of the same shape keeps.
 */
function mapFormulaNode(
  node: VariableFormulaNode,
  map: MapColor,
  slot: string
): VariableFormulaNode {
  let literals = 0
  return foldFormula<VariableFormulaNode>(node, {
    literal: (value) => {
      const at = `${slot}.${literals++}`
      // A literal object is a color; numbers, strings, and booleans stay.
      return typeof value === 'object' ? map(value, at) : value
    },
    reference: (aliasId) => ({ aliasId }),
    operation: ({ operator }, operands) => ({ operator, operands })
  })
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

/** A variable's values with their colors mapped, written nowhere yet. */
function mappedVariableValues(
  values: Variable['valuesByMode'],
  map: MapColor
): Variable['valuesByMode'] {
  return Object.fromEntries(
    Object.entries(values).map(([mode, value]) => [mode, mapVariableValue(value, map, mode)])
  )
}

function writeVariableValues(
  graph: SceneGraph,
  id: string,
  values: Variable['valuesByMode']
): void {
  const variable = graph.variables.get(id)
  if (!variable) return
  graph.willChangeVariable(id)
  variable.valuesByMode = values
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
  /**
   * The slots the last undo swapped back, as `owner slot`, which a redo swaps again and no
   * others: a color undo left alone, edited since, stays as it is through redo too.
   */
  undone: Set<string>
}

/** The field each slot's first segment names, so a write sets only the fields whose colors changed. */
const SLOT_FIELDS = {
  fills: 'fills',
  strokes: 'strokes',
  effects: 'effects',
  runs: 'styleRuns',
  decoration: 'textDecorationFills',
  grids: 'layoutGrids',
  regions: 'vectorNetwork'
} as const satisfies Record<string, keyof NodeColorFields>

/** Writes the fields of `fields` that `slots` changed onto layer `id`. */
function writeChangedFields(
  graph: SceneGraph,
  id: string,
  fields: NodeColorFields,
  slots: Iterable<string>
): void {
  const changed = new Set<keyof NodeColorFields>()
  for (const slot of slots) {
    changed.add(SLOT_FIELDS[slot.slice(0, slot.indexOf('.')) as keyof typeof SLOT_FIELDS])
  }
  if (changed.size > 0) graph.updateNode(id, pick(fields, [...changed]))
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

/**
 * Undoing swaps each color of `owner` still at the value the conversion left, recording it in
 * `conversion.undone`; redoing swaps back only those still at the value undo left. Each slot
 * swapped is added to `swapped`.
 */
function swapping(
  conversion: ColorConversion,
  owner: string,
  changes: ColorChanges,
  redo: boolean,
  swapped: string[] = []
): MapColor {
  return (color, slot) => {
    const change = changes.get(slot)
    const key = `${owner} ${slot}`
    if (!change || (redo && !conversion.undone.has(key))) return color
    const [expected, next] = redo ? [change.from, change.to] : [change.to, change.from]
    if (!sameColor(color, expected)) return color
    swapped.push(slot)
    if (!redo) conversion.undone.add(key)
    return { ...next }
  }
}

/**
 * Records the converted variables' colors as the ones their bound paints last received.
 * Converting is no edit to a variable, so those paints keep what they hold, their own opacity
 * included, where a changed variable would otherwise write its color and alpha into them.
 */
function keepBoundPaints(graph: SceneGraph, variableIds: readonly string[]): void {
  if (variableIds.length === 0) return
  for (const node of layersUsingVariables(graph, variableIds)) {
    if (hasBoundPaints(node)) {
      recordWrittenBoundPaints(graph, node, { fills: node.fills, strokes: node.strokes })
    }
  }
}

/**
 * The color each bound paint's variable gives its layer, and the paint's own color, by layer and
 * binding field, as they are before a replay writes anything.
 */
type BoundColors = Map<string, Map<string, { variable: Color; paint: Color }>>

function boundColors(graph: SceneGraph, variableIds: readonly string[]): BoundColors {
  const colors: BoundColors = new Map()
  if (variableIds.length === 0) return colors
  for (const node of layersUsingVariables(graph, variableIds)) {
    const fields = new Map<string, { variable: Color; paint: Color }>()
    for (const [field, variableId] of Object.entries(node.boundVariables)) {
      const target = paintBindingTarget(field)
      const paint = target && node[target.list].at(target.index)
      const variable = graph.resolveColorVariableForNode(node.id, variableId)
      if (paint && variable) fields.set(field, { variable, paint: { ...paint.color } })
    }
    if (fields.size > 0) colors.set(node.id, fields)
  }
  return colors
}

/**
 * Gives each bound paint that showed the color its variable gave it before a replay, such as one
 * refreshed in another mode since converting, the color its variable gives it now, keeping the
 * paint's own opacity. Undo puts a variable's colors back, and a paint showing the converted one
 * would otherwise keep it. A paint that held a color of its own is left to the layer's replay.
 */
function followBoundPaints(graph: SceneGraph, before: BoundColors): void {
  for (const [id, fields] of before) {
    const node = graph.getNode(id)
    if (!node) continue
    const lists: Pick<Partial<SceneNode>, 'fills' | 'strokes'> = {}
    for (const [field, before] of fields) {
      const target = paintBindingTarget(field)
      const variableId = node.boundVariables[field]
      const now = variableId && graph.resolveColorVariableForNode(id, variableId)
      if (!target || !now || !sameRGB(before.paint, before.variable)) continue
      if (sameRGB(before.variable, now)) continue
      const list =
        target.list === 'fills'
          ? (lists.fills ??= node.fills.map(copyFill))
          : (lists.strokes ??= node.strokes.map(copyStroke))
      const paint = list.at(target.index)
      if (paint) paint.color = { ...now, a: paint.color.a }
    }
    if (lists.fills || lists.strokes) graph.updateNode(id, lists)
  }
}

function sameRGB(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b
}

/**
 * Rewrites every stored color in `graph` through `convert`: layers' color fields, page
 * backgrounds, and color variables. Returns what it changed, for {@link replayConversion}.
 */
export function convertColors(
  graph: SceneGraph,
  convert: (color: Color) => Color
): ColorConversion {
  const conversion: ColorConversion = {
    layers: new Map(),
    pages: new Map(),
    variables: new Map(),
    undone: new Set()
  }
  // Variables are mapped before anything is written: a formula too deep to walk throws here,
  // leaving the document as it was. Other variables' formulas are walked too, as reconciling
  // bindings afterwards walks them.
  for (const variable of graph.variables.values()) {
    if (variable.type === 'COLOR') continue
    for (const value of Object.values(variable.valuesByMode)) variableValueReferences(value)
  }
  const variables = new Map<string, Variable['valuesByMode']>()
  for (const variable of graph.variables.values()) {
    if (variable.type !== 'COLOR') continue
    const changes: ColorChanges = new Map()
    const values = mappedVariableValues(variable.valuesByMode, recording(convert, changes))
    if (changes.size === 0) continue
    variables.set(variable.id, values)
    conversion.variables.set(variable.id, changes)
  }
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
    writeChangedFields(graph, node.id, fields, changes.keys())
    conversion.layers.set(node.id, changes)
  }
  for (const [id, values] of variables) writeVariableValues(graph, id, values)
  keepBoundPaints(graph, [...conversion.variables.keys()])
  reconcileVariableLayouts(graph, { variables: [...conversion.variables.keys()] })
  return conversion
}

/**
 * Undoes `conversion`, or redoes it when `redo` is set. A page untouched since gets its whole
 * source from the other side; everywhere else only colors still at the value it left swap.
 */
export function replayConversion(graph: SceneGraph, conversion: ColorConversion, redo: boolean) {
  if (!redo) conversion.undone.clear()
  const bound = boundColors(graph, [...conversion.variables.keys()])
  const variables = new Map<string, Variable['valuesByMode']>()
  for (const [id, changes] of conversion.variables) {
    const variable = graph.variables.get(id)
    const map = swapping(conversion, `variable:${id}`, changes, redo)
    if (variable) variables.set(id, mappedVariableValues(variable.valuesByMode, map))
  }
  for (const [id, changes] of conversion.layers) {
    const node = graph.getNode(id)
    const swapped: string[] = []
    const map = swapping(conversion, `layer:${id}`, changes, redo, swapped)
    const fields = node && mapNodeColors(node, map)
    if (fields) writeChangedFields(graph, id, fields, swapped)
  }
  for (const [id, { before, after, colors }] of conversion.pages) {
    const page = graph.getNode(id)
    if (!page) continue
    const owner = `page:${id}`
    const [expected, target] = redo ? [before, after] : [after, before]
    const whole = !redo || conversion.undone.has(`${owner} *`)
    if (whole && isEqual(page.source, expected)) {
      graph.updateNode(id, { source: structuredClone(target) })
      if (!redo) {
        conversion.undone.add(`${owner} *`)
        for (const slot of colors.keys()) conversion.undone.add(`${owner} ${slot}`)
      }
      continue
    }
    const map = swapping(conversion, owner, colors, redo)
    const backgrounds = mapFills(getPageBackgrounds(page), map, 'backgrounds')
    graph.updateNode(id, { source: pageSourceWithBackgrounds(page, backgrounds) })
  }
  for (const [id, values] of variables) writeVariableValues(graph, id, values)
  followBoundPaints(graph, bound)
  keepBoundPaints(graph, [...conversion.variables.keys()])
  reconcileVariableLayouts(graph, { variables: [...conversion.variables.keys()] })
}
