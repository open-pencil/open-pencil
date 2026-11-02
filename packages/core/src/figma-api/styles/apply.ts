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

import { rangeSharedStylePatch } from '#core/figma-api/text/bindings'
import {
  layerTextStyleChanges,
  styleRunsWithPatch,
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

/** Applies changes to a layer the way the plugin API's own setters do. */
export type LayerUpdate = (node: SceneNode, changes: Partial<SceneNode>) => void

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

/** A layer that uses a style itself, and the fields it uses it through, as Figma lists them. */
export interface StyleConsumer {
  node: SceneNode
  fields: InheritedStyleField[]
}

function usesStyles(graph: SceneGraph, node: SceneNode): boolean {
  // A style's own node is no consumer, and layers inside an instance follow their component.
  return node.sharedStyleType === null && !findInstanceAncestor(graph, node.id)
}

/** The layers that use `style` themselves; characters of a text that use it are not listed. */
export function styleConsumers(graph: SceneGraph, style: SceneNode): StyleConsumer[] {
  const kinds = style.sharedStyleType ? KINDS_OF_TYPE[style.sharedStyleType] : []
  const consumers: StyleConsumer[] = []
  for (const node of graph.getAllNodes()) {
    if (!usesStyles(graph, node)) continue
    const fields = kinds
      .map((kind) => sharedStyleRefKey(kind))
      .filter((field) => node[field] === style.source.id)
    if (fields.length > 0) consumers.push({ node, fields })
  }
  return consumers
}

/** The runs of a text after `patch` restyles every run that refers to the style with `id`. */
function restyledRuns(
  node: SceneNode,
  field: 'textStyleId' | 'fillStyleId',
  id: string,
  patch: CharacterStyleOverride
): SceneNode['styleRuns'] | null {
  let current = node
  let changed = false
  for (const run of node.styleRuns) {
    if (run.style[field] !== id) continue
    const styleRuns = styleRunsWithPatch(current, run.start, run.start + run.length, patch)
    current = { ...current, styleRuns }
    changed = true
  }
  return changed ? current.styleRuns : null
}

/**
 * Gives every layer and every text range that uses `style` its current values, as Figma does
 * once a style changes; `patch` decides each layer's changes for each kind it uses.
 */
function updateUsers(
  graph: SceneGraph,
  style: SceneNode,
  update: LayerUpdate,
  patch: (node: SceneNode, kind: SharedStyleKind) => Partial<SceneNode>,
  rangePatch: (kind: 'text' | 'fill') => CharacterStyleOverride
): void {
  const id = style.source.id
  if (!id || !style.sharedStyleType) return
  const kinds = KINDS_OF_TYPE[style.sharedStyleType]
  for (const node of graph.getAllNodes()) {
    if (!usesStyles(graph, node)) continue
    const changes: Partial<SceneNode> = {}
    for (const kind of kinds) {
      if (node[sharedStyleRefKey(kind)] === id) Object.assign(changes, patch(node, kind))
    }
    if (node.type === 'TEXT') {
      for (const kind of kinds) {
        if (kind !== 'text' && kind !== 'fill') continue
        const runs = restyledRuns(
          node,
          kind === 'text' ? 'textStyleId' : 'fillStyleId',
          id,
          rangePatch(kind)
        )
        if (runs) changes.styleRuns = runs
      }
    }
    if (Object.keys(changes).length > 0) update(node, changes)
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
    (kind) => rangeSharedStylePatch(graph, kind, id) ?? {}
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
