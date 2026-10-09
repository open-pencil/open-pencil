import { isEqual } from 'es-toolkit'

import {
  cloneInstanceOverrideState,
  createSceneMutationImpact,
  recordSceneMutations,
  type FigmaSourcePayload,
  type SceneGraph,
  type SceneNode,
  type SourceMetadata
} from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'

import { diffFields, type FieldChanges } from './diff'

type Side = 'before' | 'after'

/**
 * The fields an edit changed on a layer that exists on both sides. Source metadata is compared
 * a level down and its `.fig` payload a level below that, so marking a field edited keeps that
 * change rather than the layer's whole `.fig` record.
 */
interface LayerUpdate {
  id: string
  fields: FieldChanges<SceneNode> | null
  source: FieldChanges<SourceMetadata> | null
  fig: FieldChanges<FigmaSourcePayload> | null
}

/** A parent's children in one state, listed parents first. */
interface ChildList {
  id: string
  childIds: string[]
}

/**
 * What one edit did to a page: copies of only the layers it created, deleted, or changed, so an
 * undo step costs what the edit touched rather than a copy of the whole page.
 */
export interface PageChange {
  pageId: string
  /** Layers as the edit left them, parents first. */
  created: SceneNode[]
  /** Layers as they were before the edit removed them, parents first. */
  deleted: SceneNode[]
  /** Fields the edit changed on layers that exist in both states, children aside. */
  updated: LayerUpdate[]
  /** Child lists that differ between the states, each side's parents first. */
  children: Record<Side, ChildList[]>
}

const NESTED_FIELDS: ReadonlySet<keyof SceneNode> = new Set(['childIds', 'parentId', 'source'])
const SOURCE_PAYLOAD: ReadonlySet<keyof SourceMetadata> = new Set(['fig'])

function diffLayer(id: string, previous: SceneNode, current: SceneNode): LayerUpdate | null {
  const update: LayerUpdate = {
    id,
    fields: diffFields(id, previous, current, NESTED_FIELDS),
    source: diffFields(id, previous.source, current.source, SOURCE_PAYLOAD),
    fig: diffFields(id, previous.source.fig, current.source.fig)
  }
  return update.fields || update.source || update.fig ? update : null
}

function withChanges<T extends object>(value: T, changes: FieldChanges<T> | null, side: Side): T {
  if (!changes) return value
  const result = { ...value, ...structuredClone(changes[side]) }
  for (const key of changes.absent[side]) Reflect.deleteProperty(result, key)
  return result
}

function restoreLayer(graph: SceneGraph, update: LayerUpdate, side: Side): void {
  const node = graph.getNode(update.id)
  if (!node) return
  const changes: Partial<SceneNode> = update.fields ? structuredClone(update.fields[side]) : {}
  if (update.source || update.fig) {
    changes.source = {
      ...withChanges(node.source, update.source, side),
      fig: withChanges(node.source.fig, update.fig, side)
    }
  }
  graph.restoreNodeProperties(update.id, changes, update.fields?.absent[side] ?? [])
}

/**
 * A copy that keeps the layer's values as they are now. Values are replaced, never written into
 * (`materialize-instance.ts` in `@open-pencil/fig`), so sharing them is safe; the graph edits
 * child lists, source metadata, and override maps in place, so those are copied.
 */
function captureNode(node: SceneNode): SceneNode {
  const { source, instanceOverrides } = node
  return {
    ...node,
    childIds: [...node.childIds],
    source: { ...source, fig: { ...source.fig, rawNodeFields: { ...source.fig.rawNodeFields } } },
    instanceOverrides: cloneInstanceOverrideState(instanceOverrides)
  }
}

function capturePage(graph: SceneGraph, pageId: string): Map<string, SceneNode> {
  const captured = new Map<string, SceneNode>()
  const stack = [pageId]
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    const node = graph.getNode(id)
    if (!node) continue
    captured.set(id, captureNode(node))
    stack.push(...node.childIds)
  }
  return captured
}

function depthIn(nodes: (id: string) => SceneNode | undefined, id: string, pageId: string) {
  let depth = 0
  for (let node = nodes(id); node && node.id !== pageId; node = nodes(node.parentId ?? '')) depth++
  return depth
}

function isOnPage(graph: SceneGraph, node: SceneNode, pageId: string): boolean {
  for (let current: SceneNode | undefined = node; current;) {
    if (current.id === pageId) return true
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return false
}

/** Adds one touched layer to the change, given its state on each side, if it has one. */
function recordLayer(
  change: PageChange,
  id: string,
  previous: SceneNode | undefined,
  current: SceneNode | undefined
): void {
  if (previous && !isEqual(previous.childIds, current?.childIds ?? [])) {
    change.children.before.push({ id, childIds: previous.childIds })
  }
  if (current && !isEqual(current.childIds, previous?.childIds ?? [])) {
    change.children.after.push({ id, childIds: [...current.childIds] })
  }
  if (!previous) {
    if (current) change.created.push(structuredClone(current))
  } else if (!current) {
    change.deleted.push(structuredClone(previous))
  } else {
    const update = diffLayer(id, previous, current)
    if (update) change.updated.push(update)
  }
}

/**
 * Starts recording an edit to a page. Call the returned function once the edit is done, also
 * when it failed, to stop recording and get what the edit changed.
 */
export function capturePageChange(graph: SceneGraph, pageId: string): () => PageChange {
  const captured = capturePage(graph, pageId)
  const impact = createSceneMutationImpact()
  const unbind = recordSceneMutations(graph, impact)

  return () => {
    unbind()
    const change: PageChange = {
      pageId,
      created: [],
      deleted: [],
      updated: [],
      children: { before: [], after: [] }
    }
    const touched = new Set([
      ...impact.changedNodeIds,
      ...impact.previousParentIds,
      ...impact.currentParentIds
    ])
    const beforeDepth = (id: string) => depthIn((key) => captured.get(key), id, pageId)
    const afterDepth = (id: string) => depthIn((key) => graph.getNode(key), id, pageId)
    for (const id of touched) {
      const live = graph.getNode(id)
      const current = live && isOnPage(graph, live, pageId) ? live : undefined
      recordLayer(change, id, captured.get(id), current)
    }
    const byDepth = (depth: (id: string) => number) => (a: { id: string }, b: { id: string }) =>
      depth(a.id) - depth(b.id)
    change.created.sort(byDepth(afterDepth))
    change.children.after.sort(byDepth(afterDepth))
    change.deleted.sort(byDepth(beforeDepth))
    change.children.before.sort(byDepth(beforeDepth))
    return change
  }
}

export function isEmptyPageChange(change: PageChange): boolean {
  return (
    change.created.length === 0 &&
    change.deleted.length === 0 &&
    change.updated.length === 0 &&
    change.children.before.length === 0 &&
    change.children.after.length === 0
  )
}

/**
 * Puts the layers an edit touched back as they were on one side of it. The graph must be as the
 * other side left it; layers the edit did not touch are left alone.
 */
export function applyPageChange(graph: SceneGraph, change: PageChange, side: Side): void {
  const restored = side === 'before' ? change.deleted : change.created
  const removed = side === 'before' ? change.created : change.deleted
  graph.preserveSourceMetadataDuring(() => {
    for (const node of restored) {
      const { parentId, childIds: _childIds, ...fields } = structuredClone(node)
      graph.createNode(node.type, parentId ?? change.pageId, { ...fields, childIds: [] })
    }
    // Parents come first, so a layer never moves under one of its own descendants.
    for (const { id, childIds } of change.children[side]) {
      for (const [index, childId] of childIds.entries()) {
        if (graph.getNode(id)?.childIds[index] !== childId) graph.insertChildAt(childId, id, index)
      }
    }
    // Layers that survive have moved out of the removed ones by now.
    for (const node of removed) graph.deleteNode(node.id)
    for (const update of change.updated) restoreLayer(graph, update, side)
  })
  graph.clearAbsPosCache()
}

/** Undoes or redoes an edit in the editor, whichever page is on screen. */
export function restorePageChange(ctx: EditorContext, change: PageChange, side: Side): void {
  if (!ctx.graph.getNode(change.pageId)) return
  applyPageChange(ctx.graph, change, side)
  computeAllLayouts(ctx.graph, change.pageId)
  if (change.pageId === ctx.state.currentPageId) {
    ctx.setSelectedIds(new Set())
    ctx.state.hoveredNodeId = null
  }
  ctx.requestRender()
}
