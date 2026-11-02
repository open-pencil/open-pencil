import {
  figCheckpointRecords,
  type FigArchiveRecordInfo,
  type FigRecordPatch
} from '@open-pencil/fig'
import {
  nameImagesForFigma,
  type FigNodeChangeExportRuntime,
  sceneNodeToKiwi
} from '@open-pencil/fig/node-change'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import { siblingOrderKeys } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'
import { ownsSlotContent } from '@open-pencil/scene-graph/slots'
import { layersUsingVariables } from '@open-pencil/scene-graph/variables'

import { figCompressionLevel } from '#core/io/formats/fig/compression'
import {
  figExportRecordOptions,
  figFileExtras,
  prepareFigExport,
  type FigFileExtrasOptions,
  type FigExportSetup,
  type KiwiNodeChange
} from '#core/io/formats/fig/export/setup'
import { appendVariableNodeChanges } from '#core/io/formats/fig/export/variables'
import { figArchive, type FigArchiveAccess } from '#core/kiwi/fig/session/archive/access'
import { archiveChanges, type ArchiveChangeSummary } from '#core/kiwi/fig/session/archive/changes'
import {
  isReaderPagePending,
  populateFigPage,
  readerCheckpoint
} from '#core/kiwi/fig/session/document-state'

import { narrowToChangedFields, type RecordWriter } from './fields'

/** Slot content an instance writes as records of its own, which this path leaves alone. */
class UnpatchableChangeError extends Error {
  override name = 'UnpatchableChangeError'
}

/**
 * The layer whose record holds a layer: itself, or the outermost instance or generated frame it
 * sits in, since both write their contents as overrides and derived data on their own record.
 */
function recordOwner(graph: SceneGraph, id: string): string | null {
  const start = graph.getNode(id)
  if (!start) return null
  let owner: SceneNode = start
  for (let node: SceneNode | undefined = start; node;) {
    if (ownsSlotContent(graph, node)) throw new UnpatchableChangeError()
    if (node.type === 'INSTANCE' || isGeneratedFrame(node)) owner = node
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

/**
 * Records carry the values of the variables they use, through aliases and on their characters
 * too, and the modes they set. Figma draws those saved values until it resolves the binding again.
 */
function addVariableUsers(
  graph: SceneGraph,
  changes: ArchiveChangeSummary,
  add: (id: string) => unknown
): void {
  for (const node of layersUsingVariables(graph, changes.changedVariables)) add(node.id)
  if (!changes.collectionsChanged) return
  for (const node of graph.nodes.values())
    if (Object.keys(node.variableModes).length > 0) add(node.id)
}

/** Siblings keep the positions the archive saved; one that cannot moves, and so is written. */
function siblingPositions(graph: SceneGraph, records: Set<string>): Map<string, string> {
  const orderKeys = new Map<string, string>()
  const parents = new Set<string>()
  for (const id of records) {
    const node = graph.getNode(id)
    if (node && node.type !== 'CANVAS' && node.sharedStyleType === null && node.parentId)
      parents.add(node.parentId)
  }
  for (const parentId of parents) {
    // Styles are records of the internal canvas, wherever the document keeps them.
    const siblings = graph.getChildren(parentId).filter((child) => child.sharedStyleType === null)
    const keys = siblingOrderKeys(siblings.map((sibling) => sibling.source.orderKey))
    siblings.forEach((sibling, index) => {
      orderKeys.set(sibling.id, keys[index])
      if (keys[index] !== sibling.source.orderKey) records.add(sibling.id)
    })
  }
  return orderKeys
}

/**
 * Styles' positions on the internal canvas: the ones the archive saved, and new ones after the
 * internal canvas's records.
 */
function stylePositions(graph: SceneGraph, records: Set<string>, orderKeys: Map<string, string>) {
  const styles = [...records].flatMap((id) => {
    const node = graph.getNode(id)
    return node?.sharedStyleType ? [node] : []
  })
  for (const style of styles)
    if (style.source.orderKey) orderKeys.set(style.id, style.source.orderKey)
  const placed = styles.filter((style) => !style.source.orderKey)
  if (placed.length === 0) return
  const internal = graph.getPages(true).find((page) => page.internalOnly)
  const saved = (internal ? graph.getChildren(internal.id) : [])
    .filter((child) => !placed.includes(child))
    .map((child) => child.source.orderKey)
  const keys = siblingOrderKeys([...saved, ...placed.map(() => undefined)])
  placed.forEach((style, index) => orderKeys.set(style.id, keys[saved.length + index]))
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
  stylePositions(graph, records, orderKeys)
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
  const internal = setup.canvasEntries.find((entry) => entry.page.internalOnly)
  let internalWritten = false
  for (const id of ordered) {
    const node = graph.getNode(id)
    if (!node) continue
    // A style is a record of the internal canvas, which a document without one gains.
    if (node.sharedStyleType !== null) {
      if (!internal) return null
      if (!internal.page.id && !internalWritten) written.push(internal.canvasNc)
      internalWritten = true
      written.push(
        ...sceneNodeToKiwi(
          node,
          internal.canvasGuid,
          0,
          setup.localIdCounter,
          graph,
          setup.blobs,
          options
        )
      )
      continue
    }
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

/** The document record, under the archive's GUID for it. */
function documentRecord(setup: FigExportSetup, info: FigArchiveRecordInfo): KiwiNodeChange {
  const guid = info.documentId ? stringToGuid(info.documentId) : setup.docGuid
  return { ...setup.documentNc, guid }
}

/**
 * Writes an untouched copy's records as the patch writes the document's: each layer at the
 * position the archive saved, the document record, and every variable.
 */
function baselineWriter(info: FigArchiveRecordInfo): RecordWriter {
  return (graph, setup, records) => {
    const orderKeys = new Map<string, string>()
    for (const id of records) {
      const orderKey = graph.getNode(id)?.source.orderKey
      if (orderKey) orderKeys.set(id, orderKey)
    }
    const plan = { records: new Set(records), orderKeys, removed: [], replaceVariables: false }
    const written = writeRecords(setup, plan)
    if (!written) return null
    const internalPage = graph.getPages(true).find((page) => page.internalOnly)
    return [documentRecord(setup, info), ...written, ...variableRecords(setup, !!internalPage)]
  }
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
    archiveRecordIds: info.recordIds,
    archiveResourceIds: changes.resourceIds
  })
  const records = writeRecords(setup, plan)
  if (!records) return null
  // The document's own fields, its plugin data among them, are written on the document record.
  if (changes.documentChanged || changes.touched.has(graph.rootId))
    records.unshift(documentRecord(setup, info))
  if (plan.replaceVariables) {
    const internalPage = graph.getPages(true).find((page) => page.internalOnly)
    const internal = setup.canvasEntries.find((entry) => entry.page.internalOnly)
    const canvasWritten = records.some((record) => record === internal?.canvasNc)
    for (const record of variableRecords(setup, !!internalPage || canvasWritten))
      records.push(record)
  }
  const narrowed = await narrowToChangedFields(
    graph,
    runtime,
    info,
    archived.byGuid,
    records,
    baselineWriter(info)
  )
  return {
    graph,
    patch: {
      records: narrowed.records,
      fields: narrowed.fields,
      blobs: setup.blobs.slice(info.blobCount),
      removed: plan.removed,
      replaceVariables: plan.replaceVariables
    }
  }
}

const archiveImagesChecked = new WeakMap<FigArchiveAccess, Promise<boolean>>()

/**
 * Whether every image the archive `graph` was opened from holds is stored under the SHA-1 of its
 * bytes, the only name Figma reads. Archives OpenPencil wrote before image names were SHA-1 are
 * not, and records a save leaves untouched point at those names, so such a document is written
 * whole, which names every image as Figma needs, instead of reusing its archive. The archive
 * does not change, so it is checked once; a document with no archive has nothing to check.
 */
export function archiveImagesNamedForFigma(graph: SceneGraph): Promise<boolean> {
  const archive = figArchive(graph)
  if (!archive) return Promise.resolve(true)
  let checked = archiveImagesChecked.get(archive)
  if (!checked) {
    checked = archive.info().then(({ imageHashes }) =>
      imageHashes.every((name) => {
        const bytes = graph.images.get(name)
        return !bytes || computeImageHash(bytes) === name
      })
    )
    archiveImagesChecked.set(archive, checked)
  }
  return checked
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
  options: FigFileExtrasOptions = {}
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
  const imageNames = nameImagesForFigma(built.patch.records, built.graph.images)
  const extras = await figFileExtras(built.graph, imageNames, options)
  const archivedImages = new Set(info.imageHashes.map((hash) => `images/${hash}`))
  return archive.patch(built.patch, {
    thumbnailPNG: extras.thumbnailPNG,
    metaJSON: extras.metaJSON,
    images: extras.images.filter((image) => !archivedImages.has(image.name)),
    compressionLevel: figCompressionLevel(source),
    kind: source.documentKind
  })
}
