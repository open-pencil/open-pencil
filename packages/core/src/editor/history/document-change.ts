import { isEqual } from 'es-toolkit'

import {
  cloneInstanceOverrideState,
  createSceneMutationImpact,
  recordSceneMutations,
  withLiveComments,
  type FigmaSourcePayload,
  type SceneGraph,
  type SceneNode,
  type SourceMetadata,
  type Variable,
  type VariableCollection
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

/** A variable or collection on each side of an edit; `null` on the side it does not exist. */
interface RecordChange<T> {
  id: string
  before: T | null
  after: T | null
}

/**
 * What one edit did to the document: copies of only the layers, variables, and collections it
 * created, deleted, or changed, on any page, so an undo step costs what the edit touched rather
 * than a copy of the document. Comments on the document node are left out, as undo never takes
 * them back.
 */
export interface DocumentChange {
  /** The page the edit ran on, which a review of it shows. */
  pageId: string
  /** Pages whose layers the edit changed, laid out again when it is undone or redone. */
  pageIds: string[]
  /** Layers as the edit left them, parents first. */
  created: SceneNode[]
  /** Layers as they were before the edit removed them, parents first. */
  deleted: SceneNode[]
  /** Fields the edit changed on layers that exist in both states, children aside. */
  updated: LayerUpdate[]
  /** Child lists that differ between the states, each side's parents first. */
  children: Record<Side, ChildList[]>
  variables: RecordChange<Variable>[]
  collections: RecordChange<VariableCollection>[]
}

type Lookup = (id: string) => SceneNode | undefined

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

/**
 * `editedFields` marking plugin data edited as `live` does. The mark makes `.fig` export write
 * the document node's comments, so it follows them rather than undo.
 */
function markedLike(editedFields: string[], live: SceneNode): string[] {
  const marked = live.source.editedFields.includes('pluginData')
  if (editedFields.includes('pluginData') === marked) return editedFields
  return marked
    ? [...editedFields, 'pluginData']
    : editedFields.filter((field) => field !== 'pluginData')
}

/** The document node holding the comments of `live`, as undo never takes them back. */
function withCommentsOf(root: SceneNode, live: SceneNode): SceneNode {
  return {
    ...root,
    pluginData: withLiveComments(root.pluginData, live.pluginData),
    source: { ...root.source, editedFields: markedLike(root.source.editedFields, live) }
  }
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
  if (node.id === graph.rootId) {
    if (changes.pluginData)
      changes.pluginData = withLiveComments(changes.pluginData, node.pluginData)
    if (changes.source) {
      changes.source.editedFields = markedLike(changes.source.editedFields, node)
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

/** Copies a page's layers not copied yet; a layer moved in from another page keeps its copy. */
function capturePage(graph: SceneGraph, pageId: string, captured: Map<string, SceneNode>): void {
  const stack = [pageId]
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    const node = graph.getNode(id)
    if (!node) continue
    if (!captured.has(id)) captured.set(id, captureNode(node))
    stack.push(...node.childIds)
  }
}

function pageOf(nodes: Lookup, id: string): string | null {
  for (let node = nodes(id); node; node = node.parentId ? nodes(node.parentId) : undefined) {
    if (node.type === 'CANVAS') return node.id
  }
  return null
}

function depthIn(nodes: Lookup, id: string): number {
  let depth = 0
  for (let node = nodes(id); node?.parentId; node = nodes(node.parentId)) depth++
  return depth
}

/** Adds one touched layer to the change, given its state on each side, if it has one. */
function recordLayer(
  change: DocumentChange,
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

function diffRecords<T>(previous: Map<string, T>, current: Map<string, T>): RecordChange<T>[] {
  const ids = new Set([...previous.keys(), ...current.keys()])
  return [...ids].flatMap((id) => {
    const before = previous.get(id) ?? null
    const after = current.get(id) ?? null
    return isEqual(before, after) ? [] : [{ id, before, after: structuredClone(after) }]
  })
}

/** Restores records in place where they exist, as views may hold them, as atomic tools do. */
function restoreRecords<T extends object>(
  target: Map<string, T>,
  changes: RecordChange<T>[],
  side: Side
): void {
  for (const change of changes) {
    const value = change[side]
    const existing = target.get(change.id)
    if (!value) {
      target.delete(change.id)
    } else if (existing) {
      for (const key of Object.keys(existing)) {
        if (!Object.hasOwn(value, key)) Reflect.deleteProperty(existing, key)
      }
      Object.assign(existing, structuredClone(value))
    } else {
      target.set(change.id, structuredClone(value))
    }
  }
}

/**
 * Starts recording an edit made from `pageId`. Call the returned function once the edit is
 * done, also when it failed, to stop recording and get what the edit changed.
 *
 * The page is copied up front, so values written into its layers in place are kept too. Another
 * page, or the document node, is copied the first time the edit is about to change it.
 */
export function captureDocumentChange(graph: SceneGraph, pageId: string): () => DocumentChange {
  const captured = new Map<string, SceneNode>()
  const capturedPages = new Set([pageId])
  const created = new Set<string>()
  capturePage(graph, pageId, captured)
  const variables = structuredClone(graph.variables)
  const collections = structuredClone(graph.variableCollections)
  const impact = createSceneMutationImpact()
  const unbindEvents = recordSceneMutations(graph, impact)
  const unobserve = graph.observeNodeChanges({
    created: (node) => created.add(node.id),
    before: (node) => {
      if (captured.has(node.id) || created.has(node.id)) return
      const page = pageOf((id) => graph.getNode(id), node.id)
      if (page && !capturedPages.has(page)) {
        capturedPages.add(page)
        capturePage(graph, page, captured)
      }
      if (!captured.has(node.id)) captured.set(node.id, captureNode(node))
    }
  })

  return () => {
    unobserve()
    unbindEvents()
    const change: DocumentChange = {
      pageId,
      pageIds: [],
      created: [],
      deleted: [],
      updated: [],
      children: { before: [], after: [] },
      variables: diffRecords(variables, graph.variables),
      collections: diffRecords(collections, graph.variableCollections)
    }
    const before: Lookup = (id) => captured.get(id)
    const after: Lookup = (id) => graph.getNode(id)
    const pageIds = new Set<string>()
    const touched = new Set([
      ...impact.changedNodeIds,
      ...impact.previousParentIds,
      ...impact.currentParentIds
    ])
    for (const id of touched) {
      const previous = captured.get(id)
      // A layer changed without telling observers has no state to go back to.
      if (!previous && !created.has(id)) continue
      const current = graph.getNode(id)
      // Comments are never part of an undo step.
      const kept =
        previous && current && id === graph.rootId ? withCommentsOf(previous, current) : previous
      recordLayer(change, id, kept, current)
      for (const page of [pageOf(before, id), pageOf(after, id)]) if (page) pageIds.add(page)
    }
    change.pageIds = [...pageIds]
    const byDepth = (nodes: Lookup) => (a: { id: string }, b: { id: string }) =>
      depthIn(nodes, a.id) - depthIn(nodes, b.id)
    change.created.sort(byDepth(after))
    change.children.after.sort(byDepth(after))
    change.deleted.sort(byDepth(before))
    change.children.before.sort(byDepth(before))
    return change
  }
}

export function isEmptyDocumentChange(change: DocumentChange): boolean {
  return (
    change.created.length === 0 &&
    change.deleted.length === 0 &&
    change.updated.length === 0 &&
    change.children.before.length === 0 &&
    change.children.after.length === 0 &&
    change.variables.length === 0 &&
    change.collections.length === 0
  )
}

/**
 * Puts what an edit touched back as it was on one side of it. The graph must be as the other
 * side left it; what the edit did not touch is left alone, and so are comments. A graph that
 * holds only part of the document, such as one page, gets the part of the change it has room
 * for.
 */
export function applyDocumentChange(graph: SceneGraph, change: DocumentChange, side: Side): void {
  const restored = side === 'before' ? change.deleted : change.created
  const removed = side === 'before' ? change.created : change.deleted
  restoreRecords(graph.variableCollections, change.collections, side)
  restoreRecords(graph.variables, change.variables, side)
  graph.preserveSourceMetadataDuring(() => {
    for (const node of restored) {
      const { parentId, childIds: _childIds, ...fields } = structuredClone(node)
      if (!parentId || !graph.getNode(parentId)) continue
      graph.createNode(node.type, parentId, { ...fields, childIds: [] })
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
export function restoreDocumentChange(
  ctx: EditorContext,
  change: DocumentChange,
  side: Side
): void {
  applyDocumentChange(ctx.graph, change, side)
  const pageIds = new Set(change.pageIds)
  // Bound values follow their variables, so the page on screen is laid out again.
  if (change.variables.length > 0) pageIds.add(ctx.state.currentPageId)
  for (const pageId of pageIds) {
    if (ctx.graph.getNode(pageId)) computeAllLayouts(ctx.graph, pageId)
  }
  if (pageIds.has(ctx.state.currentPageId)) {
    ctx.setSelectedIds(new Set())
    ctx.state.hoveredNodeId = null
  }
  ctx.requestRender()
}
