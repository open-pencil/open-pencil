import { isEqual } from 'es-toolkit/predicate'

import { copyFills, copyStrokes } from '../copy'
import type { SceneGraph } from '../graph'
import { hasInstanceOverride } from '../instances/overrides'
import type { Color } from '../primitives'
import type { Fill, SceneNode, Stroke } from '../types'
import { paintBindingTarget, type PaintBindingList } from './fields'
import { collectionsResolving, getNodeExplicitVariableModeId } from './resolution'
import { subtreeNodes } from './subtree'

/**
 * Figma keeps a bound paint's color and opacity as a cache of its variable: it draws and reads
 * what the paint holds, and writes the variable's color into it again only once the color the
 * variable gives that layer changes, or the mode set for the layer changes, so an edit to the
 * paint sticks until then. The color each binding last gave its paint, and the modes set for the
 * layer then, live here, beside the graph and never saved, by layer and binding field. A layer
 * without an entry, such as one just restored, counts its paint's own color as the last one
 * applied, in the modes it has now.
 */
interface AppliedColor {
  readonly variableId: string
  readonly color: Color
  /** The mode set for the layer, or null, in each collection the variable resolves through. */
  readonly modes: Readonly<Record<string, string | null>>
}

const appliedColors = new WeakMap<SceneNode, Map<string, AppliedColor>>()

const PAINT_LISTS = ['fills', 'strokes'] as const

interface BoundPaint {
  readonly field: string
  readonly list: PaintBindingList
  readonly index: number
  readonly variableId: string
}

/** The paints of `node` whose color is bound to a variable, each with a paint there to color. */
function boundPaints(node: SceneNode): BoundPaint[] {
  const paints: BoundPaint[] = []
  for (const [field, variableId] of Object.entries(node.boundVariables)) {
    const target = paintBindingTarget(field)
    if (target && node[target.list].at(target.index)) paints.push({ field, ...target, variableId })
  }
  return paints
}

/** Whether a layer has a paint whose color is bound to a variable. */
export function hasBoundPaints(node: SceneNode): boolean {
  for (const field in node.boundVariables) if (paintBindingTarget(field)) return true
  return false
}

/** A paint's color with its opacity as alpha, as a variable's color carries it. */
function paintColor(paint: Fill): Color {
  return { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: paint.opacity }
}

/** Saved colors are single precision, so a color read back from a file still matches its source. */
const COLOR_TOLERANCE = 1e-6

function sameColor(a: Color, b: Color): boolean {
  return (
    Math.abs(a.r - b.r) <= COLOR_TOLERANCE &&
    Math.abs(a.g - b.g) <= COLOR_TOLERANCE &&
    Math.abs(a.b - b.b) <= COLOR_TOLERANCE &&
    Math.abs(a.a - b.a) <= COLOR_TOLERANCE
  )
}

/**
 * The modes set for a layer, or null, in the collections a variable resolves through. Figma
 * refreshes a bound paint whenever one of them changes, even to a mode giving the same color.
 */
function explicitModes(
  graph: SceneGraph,
  node: SceneNode,
  variableId: string
): Record<string, string | null> {
  const modes: Record<string, string | null> = {}
  for (const collectionId of collectionsResolving(graph, [variableId]))
    modes[collectionId] = getNodeExplicitVariableModeId(graph, node.id, collectionId)
  return modes
}

/** Whether the color a binding last applied is stale: another color, or set in other modes. */
function staleApplied(
  node: SceneNode,
  bound: BoundPaint,
  paint: Fill,
  color: Color,
  modes: Readonly<Record<string, string | null>>
): boolean {
  const entry = appliedColors.get(node)?.get(bound.field)
  if (entry?.variableId !== bound.variableId) return !sameColor(paintColor(paint), color)
  return !sameColor(entry.color, color) || !isEqual(entry.modes, modes)
}

/**
 * A layer copied from another keeps the colors its bindings last applied there, so the copy's
 * paints, edits included, stay as they are until their variables' colors for it change.
 */
export function copyAppliedBoundPaints(source: SceneNode, copy: SceneNode): void {
  const entries = appliedColors.get(source)
  if (entries) appliedColors.set(copy, new Map(entries))
}

/**
 * Pasted layers keep their paints, edits included, as Figma's copies do. One pasted from a layer
 * still in the document takes the colors that layer's bindings last applied, so a paste into
 * another mode refreshes them as a move there would; one from elsewhere counts the colors its
 * variables give it now as applied, as a loaded document does. `copies` maps each source layer's
 * id to its copy's.
 */
export function keepPastedBoundPaints(
  graph: SceneGraph,
  copies: ReadonlyMap<string, string>
): void {
  for (const [sourceId, copyId] of copies) {
    const copy = graph.nodes.get(copyId)
    if (!copy || !hasBoundPaints(copy)) continue
    const source = graph.nodes.get(sourceId)
    if (source && source !== copy) {
      copyAppliedBoundPaints(source, copy)
      refresh(graph, copy, NONE_FORCED)
    } else recordWrittenBoundPaints(graph, copy, { fills: copy.fills, strokes: copy.strokes })
  }
}

function recordApplied(
  node: SceneNode,
  bound: BoundPaint,
  color: Color,
  modes: Readonly<Record<string, string | null>>
): void {
  let entries = appliedColors.get(node)
  if (!entries) {
    entries = new Map()
    appliedColors.set(node, entries)
  }
  entries.set(bound.field, { variableId: bound.variableId, color: { ...color }, modes })
}

/** The variable's RGB at full alpha in the paint, and its alpha as the paint's opacity. */
function applyColor(paint: Fill, color: Color): void {
  paint.color = { ...color, a: 1 }
  paint.opacity = color.a
}

/** Whether `paint` already shows `color` as a bound paint stores it. */
function showsColor(paint: Fill, color: Color): boolean {
  return sameColor(paintColor(paint), color) && paint.color.a === 1
}

type PaintLists = Pick<Partial<SceneNode>, 'fills' | 'strokes'>

/**
 * Whether `node` is an instance, or a layer an instance copies from its component, with a paint
 * list neither it nor an instance around it overrides: such paints follow the component, and
 * refreshing them is no edit.
 */
export function copiesComponentPaints(
  graph: SceneGraph,
  node: SceneNode,
  list: PaintBindingList
): boolean {
  const walk = { copied: false }
  const overriding = graph.closest(node.id, (current) => {
    if (current.type !== 'INSTANCE') return false
    walk.copied = true
    return hasInstanceOverride(current.instanceOverrides, current.id, node.id, list)
  })
  return walk.copied && !overriding
}

/**
 * Writes refreshed paints. A copy's paints that follow its component are derived values that a
 * save leaves to the component, not edits written over it.
 */
function writePaints(graph: SceneGraph, node: SceneNode, changes: PaintLists): void {
  const derived = PAINT_LISTS.every(
    (list) => !changes[list] || copiesComponentPaints(graph, node, list)
  )
  const write = () => graph.updateNode(node.id, changes)
  if (derived) graph.applyComponentDerivedDuring(write)
  else write()
}

/**
 * Writes into each bound paint the color its variable gives the layer now, where that differs
 * from the color last applied, or wherever `forced` says, and records what each binding gives.
 */
function refresh(graph: SceneGraph, node: SceneNode, forced: (field: string) => boolean): void {
  let fills: Fill[] | undefined
  let strokes: Stroke[] | undefined
  for (const bound of boundPaints(node)) {
    const color = graph.resolveColorVariableForNode(node.id, bound.variableId)
    const paint = node[bound.list].at(bound.index)
    if (!color || !paint) continue
    const modes = explicitModes(graph, node, bound.variableId)
    const stale = staleApplied(node, bound, paint, color, modes)
    recordApplied(node, bound, color, modes)
    if ((!forced(bound.field) && !stale) || showsColor(paint, color)) continue
    if (bound.list === 'fills') {
      fills ??= copyFills(node.fills)
      applyColor(fills[bound.index], color)
    } else {
      strokes ??= copyStrokes(node.strokes)
      applyColor(strokes[bound.index], color)
    }
  }
  const changes: PaintLists = {}
  if (fills) changes.fills = fills
  if (strokes) changes.strokes = strokes
  if (fills || strokes) writePaints(graph, node, changes)
}

const NONE_FORCED = (): boolean => false
const ALL_FORCED = (): boolean => true

/**
 * Refreshes a layer's bound paints: each takes its variable's color for the layer, alpha as
 * opacity, once that color differs from the one last applied, discarding edits made since, as
 * Figma refreshes them when a variable's value or a layer's mode changes.
 */
export function refreshBoundPaints(graph: SceneGraph, node: SceneNode): void {
  if (hasBoundPaints(node)) refresh(graph, node, NONE_FORCED)
}

/** Gives one bound paint its variable's color for the layer, as binding it does in Figma. */
export function applyBoundPaintColor(graph: SceneGraph, node: SceneNode, field: string): void {
  if (paintBindingTarget(field)) refresh(graph, node, (bound) => bound === field)
}

/**
 * Gives every bound paint in this subtree its variable's color where it sits. A new instance
 * or a layer an instance sync adds is a copy, which shows its variables in its own context rather
 * than whatever its component's paints hold.
 */
export function applyBoundPaintColorsIn(graph: SceneGraph, rootId: string): void {
  for (const node of subtreeNodes(graph, [rootId]))
    if (hasBoundPaints(node)) refresh(graph, node, ALL_FORCED)
}

/** Refreshes the bound paints in this subtree whose variables now give their layers another color. */
export function refreshBoundPaintsIn(graph: SceneGraph, rootId: string): void {
  for (const node of subtreeNodes(graph, [rootId])) refreshBoundPaints(graph, node)
}

/**
 * Records, for the paint lists a write sets, the colors their variables give the layer now, so a
 * paint written with another color or opacity keeps it until that color changes.
 */
export function recordWrittenBoundPaints(
  graph: SceneGraph,
  node: SceneNode,
  written: PaintLists
): void {
  for (const bound of boundPaints(node)) {
    if (!written[bound.list]) continue
    const color = graph.resolveColorVariableForNode(node.id, bound.variableId)
    if (color) recordApplied(node, bound, color, explicitModes(graph, node, bound.variableId))
  }
}

/**
 * Refreshes the bound paints in a moved layer's subtree that resolve through a collection whose
 * mode set the move changed, as Figma does when a layer enters a frame or page that sets another
 * mode, or one where none was. A move between parents setting the same modes, or of layers that
 * bind no paint, costs no more than comparing those modes.
 */
export function refreshMovedBoundPaints(
  graph: SceneGraph,
  nodeId: string,
  previousParentId: string | null | undefined
): void {
  if (graph.isApplyingImportedState || graph.variableCollections.size === 0) return
  const parentId = graph.nodes.get(nodeId)?.parentId
  if (!parentId) return
  const previous = previousParentId && graph.nodes.has(previousParentId) ? previousParentId : null
  const changed = new Set(
    [...graph.variableCollections.keys()].filter(
      (id) =>
        !previous ||
        getNodeExplicitVariableModeId(graph, previous, id) !==
          getNodeExplicitVariableModeId(graph, parentId, id)
    )
  )
  if (changed.size === 0) return
  const reaches = new Map<string, boolean>()
  const reachesChanged = (variableId: string) => {
    let found = reaches.get(variableId)
    if (found === undefined) {
      found = [...collectionsResolving(graph, [variableId])].some((id) => changed.has(id))
      reaches.set(variableId, found)
    }
    return found
  }
  for (const node of subtreeNodes(graph, [nodeId])) {
    if (boundPaints(node).some((bound) => reachesChanged(bound.variableId)))
      refresh(graph, node, NONE_FORCED)
  }
}

function reboundPaint(
  target: SceneNode,
  bindings: Readonly<Record<string, string>>,
  list: PaintBindingList
): boolean {
  return target[list].some((_, index) => {
    const field = `${list}/${index}/color`
    return field in bindings && bindings[field] !== target.boundVariables[field]
  })
}

/**
 * A copy's bound paints are its own cache, as Figma keeps them per layer, so a component's edit
 * to its paint's color or opacity does not reach them. An instance sync writing a copy's paints
 * keeps the color and opacity of each one still bound to the same variable, and gives it the
 * variable's color for the copy once that differs from the one last applied, or when it binds
 * anew. `updates` holds what the sync writes, whose paints this sets in place.
 */
export function keepCopyBoundPaints(
  graph: SceneGraph,
  target: SceneNode,
  updates: Partial<SceneNode>
): void {
  const bindings = updates.boundVariables ?? target.boundVariables
  for (const list of PAINT_LISTS) {
    // A paint the component binds anew keeps its own paint otherwise, but takes the new color.
    if (!updates[list] && reboundPaint(target, bindings, list))
      Object.assign(updates, {
        [list]: list === 'fills' ? copyFills(target.fills) : copyStrokes(target.strokes)
      })
    updates[list]?.forEach((paint, index) => {
      const field = `${list}/${index}/color`
      const variableId = bindings[field]
      if (!variableId) return
      const bound = { field, list, index, variableId }
      const own = target[list].at(index)
      const keeps = own !== undefined && target.boundVariables[field] === variableId
      if (keeps) {
        paint.color = { ...own.color }
        paint.opacity = own.opacity
      }
      const color = graph.resolveColorVariableForNode(target.id, variableId)
      if (!color) return
      const modes = explicitModes(graph, target, variableId)
      if (!keeps || staleApplied(target, bound, own, color, modes)) applyColor(paint, color)
      recordApplied(target, bound, color, modes)
    })
  }
}
