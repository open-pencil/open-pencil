import type { InheritedStyleField } from '@figma/plugin-typings/plugin-api-standalone'

import type {
  CharacterStyleOverride,
  SceneGraph,
  SceneNode,
  SharedStyleKind,
  SharedStyleType
} from '@open-pencil/scene-graph'
import { findInstanceAncestor } from '@open-pencil/scene-graph/instances'
import {
  findSharedStyle,
  sharedStyleDetachPatch,
  sharedStylePatch,
  sharedStyleRefKey,
  sharedStyleTypeForKind
} from '@open-pencil/scene-graph/shared-styles'

import { figmaEffects, figmaFills } from '#core/figma-api/accessors/visual'
import { rangeSharedStylePatch } from '#core/figma-api/text/bindings'
import { setEffectBindings, setPaintBindings } from '#core/figma-api/variables/bindings'
import {
  layerTextStyleChanges,
  styleRunsWithPatchOver,
  textStyleChanges
} from '#core/text/character-style'

/** Figma's message for a style ID the document does not hold, or one of another kind. */
export const STYLE_NOT_FOUND = 'Cannot set style successfully: Cannot find style'

/** The kinds of reference a style of each type is used through. */
const KINDS_OF_TYPE: Record<SharedStyleType, readonly SharedStyleKind[]> = {
  FILL: ['fill', 'stroke'],
  TEXT: ['text'],
  EFFECT: ['effect'],
  GRID: ['grid']
}

/**
 * Applies changes to a layer the way the plugin API's own setters do. A layer inside an instance
 * takes a style's values without them counting as its own overrides.
 */
export type LayerUpdate = (
  node: SceneNode,
  changes: Partial<SceneNode>,
  inInstance: boolean
) => void

/**
 * The changes that give `node` the style with `styleId`, or take its style off when the ID is
 * empty, keeping the values it had; null when the document holds no such style. A text takes a
 * text or fill style in every character, as Figma's node setters give it.
 */
export function styleChanges(
  graph: SceneGraph,
  node: SceneNode,
  kind: SharedStyleKind,
  styleId: string
): Partial<SceneNode> | null {
  const wholeText = node.type === 'TEXT' && (kind === 'text' || kind === 'fill')
  if (styleId === '') {
    // Every character leaves the style, those that use it themselves too.
    const patch = sharedStyleDetachPatch(kind)
    return wholeText ? textStyleChanges(node, patch) : patch
  }
  const style = findSharedStyle(graph, styleId, sharedStyleTypeForKind(kind))
  if (!style) return null
  const patch = sharedStylePatch(kind, node, styleId, style)
  return wholeText ? layerTextStyleChanges(node, patch) : patch
}

/**
 * Binds `node`'s fills or strokes to the variables its paint style's paints are bound to, and
 * drops bindings the style's paints do not carry, so the layer follows them as in Figma.
 */
export function bindStylePaints(
  graph: SceneGraph,
  node: SceneNode,
  kind: SharedStyleKind,
  styleId: string
): void {
  if ((kind !== 'fill' && kind !== 'stroke') || !styleId) return
  const style = findSharedStyle(graph, styleId, 'FILL')
  if (!style) return
  setPaintBindings(graph, node, kind === 'fill' ? 'fills' : 'strokes', figmaFills(graph, style))
}

/**
 * Binds `node`'s effects to the variables its effect style's effects are bound to, and drops
 * bindings the style's effects do not carry, so the layer follows them in its own mode as in Figma.
 */
export function bindStyleEffects(
  graph: SceneGraph,
  node: SceneNode,
  kind: SharedStyleKind,
  styleId: string
): void {
  if (kind !== 'effect' || !styleId) return
  const style = findSharedStyle(graph, styleId, 'EFFECT')
  if (!style) return
  setEffectBindings(graph, node, figmaEffects(style))
}

/** Binds `node` to the variables the style it now uses binds, for each kind that binds any. */
export function bindStyleVariables(
  graph: SceneGraph,
  node: SceneNode,
  kind: SharedStyleKind,
  styleId: string
): void {
  bindStylePaints(graph, node, kind, styleId)
  bindStyleEffects(graph, node, kind, styleId)
}

/** A layer that uses a style itself, and the fields it uses it through, as Figma lists them. */
export interface StyleConsumer {
  node: SceneNode
  fields: InheritedStyleField[]
}

/** Whether `node` sits inside an instance; an instance itself does not. */
function insideInstance(graph: SceneGraph, node: SceneNode): boolean {
  return node.parentId !== null && findInstanceAncestor(graph, node.parentId) !== undefined
}

function listedConsumer(graph: SceneGraph, node: SceneNode): boolean {
  // A style's own node is no consumer, and layers inside an instance follow their component.
  return node.sharedStyleType === null && !insideInstance(graph, node)
}

/** The layers that use `style` themselves; characters of a text that use it are not listed. */
export function styleConsumers(graph: SceneGraph, style: SceneNode): StyleConsumer[] {
  const kinds = style.sharedStyleType ? KINDS_OF_TYPE[style.sharedStyleType] : []
  const consumers: StyleConsumer[] = []
  for (const node of graph.getAllNodes()) {
    if (!listedConsumer(graph, node)) continue
    const fields = kinds
      .map((kind) => sharedStyleRefKey(kind))
      .filter((field) => node[field] === style.source.id)
    if (fields.length > 0) consumers.push({ node, fields })
  }
  return consumers
}

/** The runs of a text after `patch` restyles, in one pass, every run that uses the style `id`. */
function restyledRuns(
  node: SceneNode,
  field: 'textStyleId' | 'fillStyleId',
  id: string,
  patch: () => CharacterStyleOverride
): SceneNode['styleRuns'] | null {
  const ranges = node.styleRuns
    .filter((run) => run.style[field] === id)
    .map((run) => [run.start, run.start + run.length] as const)
  return ranges.length > 0 ? styleRunsWithPatchOver(node, ranges, patch()) : null
}

/**
 * Gives every layer and text range that uses `style` its current values, as Figma does once a
 * style changes; `patch` decides each layer's changes for each kind it uses, and `after` runs on
 * each layer that uses it itself once its changes are in. Layers inside instances are updated
 * too, so one that overrides a style follows it, without the update counting as an override.
 */
function updateUsers(
  graph: SceneGraph,
  style: SceneNode,
  update: LayerUpdate,
  patch: (node: SceneNode, kind: SharedStyleKind) => Partial<SceneNode>,
  rangePatch: (kind: 'text' | 'fill') => CharacterStyleOverride,
  after?: (node: SceneNode, kind: SharedStyleKind) => void
): void {
  const id = style.source.id
  if (!id || !style.sharedStyleType) return
  const kinds = KINDS_OF_TYPE[style.sharedStyleType]
  // A style's range patch is the same for every text, so it is built once, when one needs it.
  const rangePatches = new Map<'text' | 'fill', CharacterStyleOverride>()
  const lazyRangePatch = (kind: 'text' | 'fill') => () => {
    const found = rangePatches.get(kind) ?? rangePatch(kind)
    rangePatches.set(kind, found)
    return found
  }
  for (const node of graph.getAllNodes()) {
    if (node.sharedStyleType !== null) continue
    const own = kinds.filter((kind) => node[sharedStyleRefKey(kind)] === id)
    const changes: Partial<SceneNode> = {}
    for (const kind of own) Object.assign(changes, patch(node, kind))
    if (node.type === 'TEXT') {
      // A text or fill style reaches characters through one kind of run reference.
      const runKind = kinds.find((kind) => kind === 'text' || kind === 'fill')
      const field = runKind === 'text' ? 'textStyleId' : 'fillStyleId'
      const runs = runKind && restyledRuns(node, field, id, lazyRangePatch(runKind))
      if (runs) changes.styleRuns = runs
    }
    if (Object.keys(changes).length === 0) continue
    update(node, changes, insideInstance(graph, node))
    const updated = graph.getNode(node.id)
    if (updated && after) for (const kind of own) after(updated, kind)
  }
}

/** Gives the layers and text ranges that use `style` its values, after the style changed. */
export function restyleUsers(graph: SceneGraph, style: SceneNode, update: LayerUpdate): void {
  const id = style.source.id ?? ''
  updateUsers(
    graph,
    style,
    update,
    // A layer's own fields only: its ranges keep the values they set themselves.
    (node, kind) => sharedStylePatch(kind, node, id, style),
    (kind) => rangeSharedStylePatch(graph, kind, id) ?? {},
    (node, kind) => bindStyleVariables(graph, node, kind, id)
  )
}

/** Takes `style` off everything that uses it, which keeps the values it gave, as in Figma. */
export function releaseUsers(graph: SceneGraph, style: SceneNode, update: LayerUpdate): void {
  updateUsers(
    graph,
    style,
    update,
    (_node, kind) => sharedStyleDetachPatch(kind),
    (kind) => ({ [kind === 'text' ? 'textStyleId' : 'fillStyleId']: null })
  )
}
