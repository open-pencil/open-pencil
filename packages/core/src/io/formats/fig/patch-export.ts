import type { CanvasKit } from 'canvaskit-wasm'

import {
  figCheckpointRecords,
  type FigArchiveRecordInfo,
  type FigRecordPatch
} from '@open-pencil/fig'
import type { FigNodeChangeExportRuntime } from '@open-pencil/fig/node-change'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { ownsSlotContent, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { siblingOrderKeys } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import {
  figExportRecordOptions,
  figFileExtras,
  prepareFigExport,
  type FigExportSetup,
  type KiwiNodeChange
} from '#core/io/formats/fig/export-setup'
import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { figArchive, type FigArchiveAccess } from '#core/kiwi/fig/session/archive'
import { archiveChanges, type ArchiveChangeSummary } from '#core/kiwi/fig/session/archive-changes'
import {
  isReaderPagePending,
  populateFigPage,
  readerCheckpoint
} from '#core/kiwi/fig/session/document-state'

import { appendVariableNodeChanges } from './variable-export'

export interface PatchedFigFileOptions {
  ck?: CanvasKit
  renderer?: SkiaRenderer
  pageId?: string
  renderHeadlessThumbnail?: boolean
}

/** Slot content an instance writes as records of its own, which this path leaves alone. */
class UnpatchableChangeError extends Error {
  override name = 'UnpatchableChangeError'
}

/**
 * The layer whose record holds a layer: itself, or the outermost instance it sits in, since an
 * instance writes its contents as overrides and derived data on its own record.
 */
function recordOwner(graph: SceneGraph, id: string): string | null {
  const start = graph.getNode(id)
  if (!start) return null
  let owner: SceneNode = start
  for (let node: SceneNode | undefined = start; node;) {
    if (ownsSlotContent(graph, node)) throw new UnpatchableChangeError()
    if (node.type === 'INSTANCE') owner = node
    if (node.type === 'CANVAS') return owner.id
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return null
}

/** The component definition a record sits in, if any. */
function enclosingComponent(graph: SceneGraph, id: string): SceneNode | undefined {
  for (let node = graph.getNode(id); node;) {
    if (node.type === 'COMPONENT') return node
    if (node.type === 'CANVAS') return undefined
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return undefined
}

interface RecordPlan {
  /** Layers whose records are written: pages, and layers outside instances. */
  records: Set<string>
  orderKeys: Map<string, string>
  removed: GUID[]
  replaceVariables: boolean
}

/** The layer each archive record became, by record GUID, and the record each such layer is. */
interface ArchiveRecords {
  byGuid: ReadonlyMap<string, string>
  byNode: ReadonlyMap<string, string>
}

function archiveRecords(graph: SceneGraph): ArchiveRecords | null {
  const checkpoint = readerCheckpoint(graph)
  if (!checkpoint) return null
  const byGuid = figCheckpointRecords(checkpoint)
  return { byGuid, byNode: new Map([...byGuid].map(([guid, nodeId]) => [nodeId, guid])) }
}

/** An edited component changes every instance of it, and so every component nesting one. */
function addComponentInstances(
  graph: SceneGraph,
  records: Set<string>,
  add: (id: string) => string | null
): void {
  const visited = new Set<string>()
  const pending = Array.from(records)
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const component = enclosingComponent(graph, id)
    if (!component || visited.has(component.id)) continue
    visited.add(component.id)
    for (const instanceId of graph.instanceIndex.get(component.id) ?? []) {
      const owner = add(instanceId)
      if (owner) pending.push(owner)
    }
  }
}

/** Records carry the values of the variables they use, and the modes they set. */
function addVariableUsers(
  graph: SceneGraph,
  changes: ArchiveChangeSummary,
  add: (id: string) => unknown
): void {
  for (const node of graph.nodes.values()) {
    const usesChanged = Object.values(node.boundVariables).some((id) =>
      changes.changedVariables.has(id)
    )
    const setsModes = changes.collectionsChanged && Object.keys(node.variableModes).length > 0
    if (usesChanged || setsModes) add(node.id)
  }
}

/** Siblings keep the positions the archive saved; one that cannot moves, and so is written. */
function siblingPositions(graph: SceneGraph, records: Set<string>): Map<string, string> {
  const orderKeys = new Map<string, string>()
  const parents = new Set<string>()
  for (const id of records) {
    const node = graph.getNode(id)
    if (node && node.type !== 'CANVAS' && node.parentId) parents.add(node.parentId)
  }
  for (const parentId of parents) {
    const siblings = graph.getChildren(parentId)
    const keys = siblingOrderKeys(siblings.map((sibling) => sibling.source.orderKey))
    siblings.forEach((sibling, index) => {
      orderKeys.set(sibling.id, keys[index])
      if (keys[index] !== sibling.source.orderKey) records.add(sibling.id)
    })
  }
  return orderKeys
}

function planRecords(
  graph: SceneGraph,
  changes: ArchiveChangeSummary,
  archived: ArchiveRecords
): RecordPlan {
  const records = new Set<string>()
  const add = (id: string) => {
    const owner = recordOwner(graph, id)
    if (owner) records.add(owner)
    return owner
  }
  for (const id of changes.touched) add(id)
  addComponentInstances(graph, records, add)
  const replaceVariables = changes.changedVariables.size > 0 || changes.collectionsChanged
  if (replaceVariables) addVariableUsers(graph, changes, add)
  const orderKeys = siblingPositions(graph, records)
  const removed: GUID[] = []
  for (const [guid, nodeId] of archived.byGuid)
    if (!graph.nodes.has(nodeId)) removed.push(stringToGuid(guid))
  return { records, orderKeys, removed, replaceVariables }
}

/** Components holding edited layers, by archive GUID, for finding the pages that use them. */
function editedComponents(
  graph: SceneGraph,
  changes: ArchiveChangeSummary,
  archived: ArchiveRecords
): string[] {
  const components = new Set<string>()
  for (const id of changes.touched) {
    const component = enclosingComponent(graph, id)
    const guid = component ? archived.byNode.get(component.id) : undefined
    if (guid) components.add(guid)
  }
  return [...components]
}

/**
 * Instances on pages not loaded yet still carry the overrides and sizes derived from their
 * components as saved. Loading those pages lets the edits reach them, and their records follow.
 */
async function loadComponentUsePages(
  graph: SceneGraph,
  archive: FigArchiveAccess,
  changes: ArchiveChangeSummary,
  archived: ArchiveRecords
): Promise<boolean> {
  const components = editedComponents(graph, changes, archived)
  if (components.length === 0) return false
  let loaded = false
  for (const pageGuid of await archive.componentPages(components)) {
    const pageId = archived.byGuid.get(pageGuid)
    if (pageId && isReaderPagePending(graph, pageId))
      loaded = populateFigPage(graph, pageId) || loaded
  }
  return loaded
}

function writeRecords(setup: FigExportSetup, plan: RecordPlan): KiwiNodeChange[] | null {
  const { graph } = setup
  const canvasGuids = new Map(setup.canvasEntries.map((entry) => [entry.page.id, entry]))
  const slotContentRecords: KiwiNodeChange[] = []
  const options = {
    ...figExportRecordOptions(setup),
    slotContentRecords,
    orderKeys: plan.orderKeys,
    writeChildren: false
  }
  const depth = (id: string) => {
    let count = 0
    for (let node = graph.getNode(id); node?.parentId; node = graph.getNode(node.parentId)) count++
    return count
  }
  // Parents first, so a new parent has its GUID before its children name it.
  const ordered = [...plan.records].toSorted((left, right) => depth(left) - depth(right))
  const written: KiwiNodeChange[] = []
  for (const id of ordered) {
    const node = graph.getNode(id)
    if (!node) continue
    if (node.type === 'CANVAS') {
      const entry = canvasGuids.get(node.id)
      if (entry) written.push(entry.canvasNc)
      continue
    }
    const parent = node.parentId ? graph.getNode(node.parentId) : undefined
    if (!parent) continue
    const parentGuid =
      parent.type === 'CANVAS'
        ? canvasGuids.get(parent.id)?.canvasGuid
        : setup.nodeIdToGuid.get(parent.id)
    if (!parentGuid) return null
    const index = graph.getChildren(parent.id).findIndex((child) => child.id === node.id)
    written.push(
      ...sceneNodeToKiwi(node, parentGuid, index, setup.localIdCounter, graph, setup.blobs, options)
    )
  }
  // Instance slot content is written as records of its own on the internal canvas.
  return slotContentRecords.length > 0 ? null : written
}

function variableRecords(setup: FigExportSetup, archiveInternalCanvas: boolean): KiwiNodeChange[] {
  const internal = setup.canvasEntries.find((entry) => entry.page.internalOnly)
  if (!internal) return []
  const records: KiwiNodeChange[] = archiveInternalCanvas ? [] : [internal.canvasNc]
  appendVariableNodeChanges(
    setup.graph,
    records,
    internal.canvasGuid,
    setup.varIdToGuid,
    setup.modeIdToGuid
  )
  return records
}

async function buildPatch(
  source: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  info: FigArchiveRecordInfo,
  changes: ArchiveChangeSummary,
  archived: ArchiveRecords
): Promise<{ patch: FigRecordPatch; graph: SceneGraph } | null> {
  // Serializing reads the document and writes nothing to it, so the records come from it directly.
  const graph = source
  const plan = planRecords(graph, changes, archived)
  const setup = await prepareFigExport(graph, runtime, {
    nextLocalId: info.nextLocalId,
    blobs: Array.from({ length: info.blobCount }, () => new Uint8Array(0)),
    recordOwners: archived.byGuid,
    archiveResourceIds: changes.resourceIds
  })
  const records = writeRecords(setup, plan)
  if (!records) return null
  // The document's own fields, its plugin data among them, are written on the document record.
  if (changes.documentChanged || changes.touched.has(graph.rootId)) {
    const guid = info.documentId ? stringToGuid(info.documentId) : setup.docGuid
    records.unshift({ ...setup.documentNc, guid })
  }
  if (plan.replaceVariables) {
    const internalPage = graph.getPages(true).find((page) => page.internalOnly)
    for (const record of variableRecords(setup, !!internalPage)) records.push(record)
  }
  return {
    graph,
    patch: {
      records,
      blobs: setup.blobs.slice(info.blobCount),
      removed: plan.removed,
      replaceVariables: plan.replaceVariables
    }
  }
}

/**
 * Write a document opened from a `.fig` as that archive with only its changed records
 * rewritten. The main thread serializes what changed; merging and compressing the rest happen
 * where the archive is held, the reader's worker in the browser. Null when the document did
 * not come from an archive, or changed in a way this path does not write.
 */
export async function writePatchedFigFile(
  source: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: PatchedFigFileOptions = {}
): Promise<Uint8Array | null> {
  const archive = figArchive(source)
  const changes = archiveChanges(source)
  const loaded = archiveRecords(source)
  if (!archive || !changes || !loaded) return null
  // Pages loaded for the components add their records, so the map is read again after them.
  const archived = (await loadComponentUsePages(source, archive, changes, loaded))
    ? archiveRecords(source)
    : loaded
  if (!archived) return null
  const info = await archive.info()
  let built: Awaited<ReturnType<typeof buildPatch>>
  try {
    built = await buildPatch(source, runtime, info, changes, archived)
  } catch (error) {
    if (error instanceof UnpatchableChangeError) return null
    throw error
  }
  if (!built) return null
  const extras = await figFileExtras(
    built.graph,
    options.pageId,
    options.ck,
    options.renderer,
    options.renderHeadlessThumbnail ?? false
  )
  const archivedImages = new Set(info.imageHashes.map((hash) => `images/${hash}`))
  return archive.patch(built.patch, {
    thumbnailPNG: extras.thumbnailPNG,
    metaJSON: extras.metaJSON,
    images: extras.images.filter((image) => !archivedImages.has(image.name))
  })
}
