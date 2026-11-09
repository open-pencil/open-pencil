import { isEqual, omit } from 'es-toolkit'

import type {
  FigmaSourcePayload,
  SceneGraph,
  SceneNode,
  SourceMetadata,
  Variable,
  VariableCollection
} from '@open-pencil/scene-graph'
import type { TouchedCheckpoint } from '@open-pencil/scene-graph/checkpoint'
import { withLiveComments } from '@open-pencil/scene-graph/comments'
import { cloneInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'
import {
  createSceneMutationImpact,
  recordSceneMutations
} from '@open-pencil/scene-graph/mutation-impact'

import type { EditorContext } from '#core/editor/types'
import { computeAllLayouts } from '#core/layout'

import { diffFields, type FieldChanges } from './diff'
import {
  adoptChanges,
  adoptRecordChanges,
  copyRecord,
  recordChangesOf,
  restoreRecords,
  type RecordChange,
  type RecordCopies,
  type Side
} from './records'

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

/** Layers by id: the live graph's, or those captured before the edit. */
type Lookup = Pick<ReadonlyMap<string, SceneNode>, 'get' | 'size'>

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

/**
 * A layer and its ancestors, nearest first. Like `SceneGraph.closest`, the walk visits at most as
 * many layers as there are, so a parent cycle in bad data cannot hang it.
 */
function* lineage(nodes: Lookup, id: string): Generator<SceneNode> {
  let node = nodes.get(id)
  for (let steps = 0; node && steps < nodes.size; steps++) {
    yield node
    node = node.parentId ? nodes.get(node.parentId) : undefined
  }
}

function pageOf(nodes: Lookup, id: string): string | null {
  for (const node of lineage(nodes, id)) if (node.type === 'CANVAS') return node.id
  return null
}

function depthIn(nodes: Lookup, id: string): number {
  let depth = 0
  for (const node of lineage(nodes, id)) if (node.parentId) depth++
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

/** The layers a recorded mutation touched, including the parents it moved layers between. */
function touchedIds(impact: ReturnType<typeof createSceneMutationImpact>): Set<string> {
  return new Set([
    ...impact.changedNodeIds,
    ...impact.previousParentIds,
    ...impact.currentParentIds
  ])
}

/**
 * Starts recording an edit made from `pageId`. Call the returned function once the edit is
 * done, also when it failed, to stop recording and get what the edit changed.
 *
 * Nothing is copied up front, so recording costs what the edit touches: a layer is copied the
 * first time the graph reports it about to change (`SceneGraph.observeNodeChanges`), with its
 * ancestors below the page, which keep instance override maps the graph writes into in place,
 * and a variable or collection the first time it is reported (`willChangeVariable`).
 *
 * While the edit waits outside itself (`SceneGraph.waitOutsideEdit`), changes are someone else's:
 * they stay out of the edit, and a layer or record they changed that the edit had not starts
 * from its new state.
 */
export function captureDocumentChange(graph: SceneGraph, pageId: string): () => DocumentChange {
  const captured = new Map<string, SceneNode>()
  const created = new Set<string>()
  const variables: RecordCopies<Variable> = new Map()
  const collections: RecordCopies<VariableCollection> = new Map()
  const impact = createSceneMutationImpact()
  let elsewhere: ReturnType<typeof createSceneMutationImpact> | null = null
  const layersAtPause = new Map<string, SceneNode>()
  const variablesAtPause: RecordCopies<Variable> = new Map()
  const collectionsAtPause: RecordCopies<VariableCollection> = new Map()
  const unbindEvents = recordSceneMutations(graph, impact, () => !elsewhere)
  let stopElsewhere: () => void = () => undefined

  /** Copies `node` and each ancestor below its page not copied yet, nearest first. */
  function copyLineage(node: SceneNode) {
    for (const layer of lineage(graph.nodes, node.id)) {
      if (captured.has(layer.id) || created.has(layer.id)) return
      if (layer !== node && layer.type === 'CANVAS') return
      captured.set(layer.id, captureNode(layer))
    }
  }

  const unobserve = graph.observeNodeChanges({
    created: (node) => {
      if (!elsewhere) created.add(node.id)
    },
    before: (node) => {
      if (!elsewhere) copyLineage(node)
      else if (!layersAtPause.has(node.id)) layersAtPause.set(node.id, captureNode(node))
    },
    beforeRecord: (kind, id) => {
      if (kind === 'variable') {
        copyRecord(elsewhere ? variablesAtPause : variables, graph.variables, id)
      } else {
        copyRecord(elsewhere ? collectionsAtPause : collections, graph.variableCollections, id)
      }
    },
    pause: () => {
      if (elsewhere) return
      const other = createSceneMutationImpact()
      elsewhere = other
      stopElsewhere = recordSceneMutations(graph, other)
    },
    resume: () => {
      if (!elsewhere) return
      stopElsewhere()
      const own = touchedIds(impact)
      for (const id of new Set([...touchedIds(elsewhere), ...layersAtPause.keys()])) {
        const baseline = captured.get(id)
        if (!baseline) continue
        const node = graph.getNode(id)
        const atPause = layersAtPause.get(id)
        // A layer removed meanwhile is no longer the edit's to put back.
        if (!node) captured.delete(id)
        else if (!own.has(id)) captured.set(id, captureNode(node))
        else if (atPause) captured.set(id, adoptChanges(baseline, atPause, node))
      }
      layersAtPause.clear()
      adoptRecordChanges(variables, variablesAtPause, graph.variables)
      adoptRecordChanges(collections, collectionsAtPause, graph.variableCollections)
      variablesAtPause.clear()
      collectionsAtPause.clear()
      elsewhere = null
    }
  })

  return () => {
    unobserve()
    unbindEvents()
    stopElsewhere()

    // Layers not copied are as they were, apart from those the edit added.
    const previous: Lookup = {
      get: (id) => captured.get(id) ?? (created.has(id) ? undefined : graph.getNode(id)),
      size: graph.nodes.size + captured.size
    }
    // Ancestors are copied because the graph writes instance overrides into them in place.
    const ids = new Set([...touchedIds(impact), ...captured.keys()])
    return buildDocumentChange(graph, pageId, ids, previous, created, {
      variables: recordChangesOf(variables, graph.variables),
      collections: recordChangesOf(collections, graph.variableCollections)
    })
  }
}

type RecordChanges = Pick<DocumentChange, 'variables' | 'collections'>

/**
 * The change of the touched layers `ids`, given each one's state before the edit in `previous`,
 * which also gives the ancestors of layers the edit moved or removed. A layer neither in
 * `previous` nor `created` changed without telling observers and has no state to go back to.
 */
function buildDocumentChange(
  graph: SceneGraph,
  pageId: string,
  ids: Iterable<string>,
  previous: Lookup,
  created: ReadonlySet<string>,
  records: RecordChanges
): DocumentChange {
  const change: DocumentChange = {
    ...emptyDocumentChange(pageId),
    variables: records.variables,
    collections: records.collections
  }
  const pageIds = new Set<string>()
  for (const id of ids) {
    const before = previous.get(id)
    if (!before && !created.has(id)) continue
    const current = graph.getNode(id)
    // Comments are never part of an undo step.
    const kept = before && current && id === graph.rootId ? withCommentsOf(before, current) : before
    recordLayer(change, id, kept, current)
    for (const page of [pageOf(previous, id), pageOf(graph.nodes, id)]) if (page) pageIds.add(page)
  }
  change.pageIds = [...pageIds]
  const byDepth = (nodes: Lookup) => (a: { id: string }, b: { id: string }) =>
    depthIn(nodes, a.id) - depthIn(nodes, b.id)
  change.created.sort(byDepth(graph.nodes))
  change.children.after.sort(byDepth(graph.nodes))
  change.deleted.sort(byDepth(previous))
  change.children.before.sort(byDepth(previous))
  return change
}

/** A change that changed nothing, as an edit that failed or did nothing records. */
export function emptyDocumentChange(pageId: string): DocumentChange {
  return {
    pageId,
    pageIds: [],
    created: [],
    deleted: [],
    updated: [],
    children: { before: [], after: [] },
    variables: [],
    collections: []
  }
}

/** The variables and collections an edit changed, against the copies a checkpoint took. */
export function recordChanges(graph: SceneGraph, checkpoint: TouchedCheckpoint): RecordChanges {
  return {
    variables: recordChangesOf(checkpoint.variables, graph.variables),
    collections: recordChangesOf(checkpoint.variableCollections, graph.variableCollections)
  }
}

/**
 * What a property edit observed by `checkpoint` changed, at the cost of the layers it touched:
 * each copied layer is compared with the live one. Layers the checkpoint did not copy are read
 * live, which they still are, so the pages of the copied layers are found.
 */
export function documentChangeFromCheckpoint(
  graph: SceneGraph,
  pageId: string,
  checkpoint: TouchedCheckpoint,
  records: RecordChanges = recordChanges(graph, checkpoint)
): DocumentChange {
  const created = new Set([...checkpoint.reported].filter((id) => !checkpoint.nodes.has(id)))
  // A layer the edit created has no state before it, though the live graph now holds one.
  const previous: Lookup = {
    get: (id) => checkpoint.nodes.get(id) ?? (created.has(id) ? undefined : graph.getNode(id)),
    size: graph.nodes.size
  }
  const ids = [...checkpoint.nodes.keys(), ...created]
  return buildDocumentChange(graph, pageId, ids, previous, created, records)
}

/**
 * How many layers `checkpoint` saw reported whose own fields now differ, children, parent, and
 * source metadata aside: the layers whose content an undo step would hold. A write of the value a
 * layer already had is not counted.
 */
export function countChangedLayers(graph: SceneGraph, checkpoint: TouchedCheckpoint): number {
  const skipped = [...NESTED_FIELDS]
  let count = 0
  for (const id of checkpoint.reported) {
    const previous = checkpoint.nodes.get(id)
    const current = graph.getNode(id)
    const same = previous && current && isEqual(omit(previous, skipped), omit(current, skipped))
    if (!same) count++
  }
  return count
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
/**
 * Moves the children of `removed` layers that are not removed with them, layers someone else put
 * there, to the nearest parent that stays, where the outermost removed layer was, keeping their
 * place on the canvas.
 */
function keepOthersLayers(graph: SceneGraph, removed: readonly SceneNode[]): void {
  const removedIds = new Set(removed.map((node) => node.id))
  for (const { id } of removed) {
    const live = graph.getNode(id)
    if (!live) continue
    const others = live.childIds.filter((childId) => !removedIds.has(childId))
    if (others.length === 0) continue
    let outermost = live
    let holder = live.parentId ? graph.getNode(live.parentId) : undefined
    while (holder && removedIds.has(holder.id)) {
      outermost = holder
      holder = holder.parentId ? graph.getNode(holder.parentId) : undefined
    }
    if (!holder) continue
    for (const childId of others) {
      graph.reparentNode(childId, holder.id)
      graph.insertChildAt(childId, holder.id, holder.childIds.indexOf(outermost.id))
    }
  }
}

export function applyDocumentChange(graph: SceneGraph, change: DocumentChange, side: Side): void {
  const restored = side === 'before' ? change.deleted : change.created
  const removed = side === 'before' ? change.created : change.deleted
  restoreRecords(graph.variableCollections, change.collections, side, (id) =>
    graph.willChangeCollection(id)
  )
  restoreRecords(graph.variables, change.variables, side, (id) => graph.willChangeVariable(id))
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
    // Layers that survive have moved out of the removed ones by now, except ones the edit never
    // touched, such as a collaborator's put into an agent's frame: those move out here.
    keepOthersLayers(graph, removed)
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
