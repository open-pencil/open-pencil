import type { CanvasKit } from 'canvaskit-wasm'
import { deflateSync, inflateSync } from 'fflate'
import { toUint8Array } from 'js-base64'

import { figArchiveMetaJSON } from '@open-pencil/fig'
import {
  buildComponentPropIndex,
  exportCanvasGuides,
  figImageEntries,
  importCanvasGuides,
  parseGuidOrNull,
  type FigNodeChangeExportRuntime,
  makeCanvasNodeChange,
  makeDocumentNodeChange
} from '@open-pencil/fig/node-change'
import { getCompiledSchema, getSchemaBytes, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'
import type { PluginDataEntry, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  readBehaviour,
  renameBehaviourProperties,
  withBehaviour
} from '@open-pencil/scene-graph/behaviours'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'
import type { GUID, Rect, Size } from '@open-pencil/scene-graph/primitives'
import { ownsSlotContent } from '@open-pencil/scene-graph/slots'

import type { SkiaRenderer } from '#core/canvas'
import { CANVAS_BG_COLOR, IS_BROWSER, IS_TAURI } from '#core/constants'
import { getPageColor } from '#core/figma-api/page-backgrounds'
import { applyDocumentPluginData } from '#core/io/formats/fig/document-metadata'
import { figThumbnailPageId } from '#core/io/formats/fig/thumbnail-page'
import { renderThumbnail, thumbnailFrame } from '#core/io/formats/raster'
import { settleFontDigestMap } from '#core/kiwi/fig/node-change/serialize'

import { assignVariableGuid, assignVariableGuids } from './variables'

/**
 * What a `.fig` write shares however many records it writes: the GUID maps, caches and
 * canvases, the schema, and the thumbnail and images beside the records.
 */
const THUMBNAIL_1X1 = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
)

export type KiwiNodeChange = NodeChange & Record<string, unknown>
export type FigExportPage = ReturnType<SceneGraph['getPages']>[number]

export interface CanvasExportEntry {
  page: FigExportPage
  canvasGuid: GUID
  canvasNc: KiwiNodeChange
}

const THUMBNAIL_WIDTH = 512
const THUMBNAIL_HEIGHT = 512
/** The name Figma gives a file it was not told the name of. */
const UNTITLED_FILE_NAME = 'Untitled'

interface FigThumbnail {
  png: Uint8Array
  size: Size
  /** The page-space rectangle the thumbnail shows; empty for the 1×1 placeholder. */
  region: Rect
}

function placeholderThumbnail(): FigThumbnail {
  return {
    png: THUMBNAIL_1X1,
    size: { width: 1, height: 1 },
    region: { x: 0, y: 0, width: 0, height: 0 }
  }
}

async function renderFigThumbnailPNG(
  graph: SceneGraph,
  pageId: string,
  options: FigFileExtrasOptions
): Promise<Uint8Array | null> {
  const { ck, renderer } = options
  if (ck && renderer) {
    return renderThumbnail(ck, renderer, graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
  }
  if (!options.renderHeadlessThumbnail || IS_BROWSER || IS_TAURI) return null
  const { headlessRenderThumbnail } = await import('#core/io/formats/raster')
  return headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
}

async function renderFigThumbnail(
  graph: SceneGraph,
  pageId: string | undefined,
  options: FigFileExtrasOptions
): Promise<FigThumbnail> {
  const frame = pageId ? thumbnailFrame(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT) : null
  if (!pageId || !frame) return placeholderThumbnail()
  const png = await renderFigThumbnailPNG(graph, pageId, options)
  if (!png) return placeholderThumbnail()
  const { minX, minY, maxX, maxY } = frame.bounds
  return {
    png,
    size: { width: frame.width, height: frame.height },
    region: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
}

/**
 * The GUID a layer without a `source.id` is saved under: its graph ID, which has Figma's
 * `sessionID:localID` shape and never changes, so later saves keep it. A layer opened from a
 * file has its record's GUID as its ID, so it keeps that record even when something, such as a
 * room's copy of it, cleared its `source.id`. Another layer that keeps the GUID as its
 * `source.id`, and GUIDs already written, win over it.
 */
function ownGuid(
  id: string,
  sourceOwners: ReadonlyMap<string, string>,
  assignedGuidValues: ReadonlySet<string>
): GUID | null {
  const guid = parseGuidOrNull(id)
  if (!guid) return null
  const key = `${guid.sessionID}:${guid.localID}`
  const owner = sourceOwners.get(key)
  return (owner !== undefined && owner !== id) || assignedGuidValues.has(key) ? null : guid
}

/**
 * Whether a layer was opened from a file. A style keeps an ID of its own in `source.id`, which
 * only names a saved record when it spells a GUID; one made by token import or paste does not.
 */
function savedFromFile(node: SceneNode): boolean {
  if (!node.source.id) return false
  return node.sharedStyleType === null || parseGuidOrNull(node.source.id) !== null
}

function assignOwnLayerGuids(
  graph: SceneGraph,
  sourceOwners: ReadonlyMap<string, string>,
  nodeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>
): void {
  for (const node of graph.nodes.values()) {
    if (savedFromFile(node) || node.id === graph.rootId || nodeIdToGuid.has(node.id)) continue
    const guid = ownGuid(node.id, sourceOwners, assignedGuidValues)
    if (!guid) continue
    nodeIdToGuid.set(node.id, guid)
    assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
  }
}

/**
 * The first local ID the counter can mint in sessions 0 and 1: past every saved GUID and every
 * ID that layers, collections, modes, variables and component properties are saved under.
 */
/** The first local ID above every GUID the graph's layers, variables, and properties claim. */
export function firstUnclaimedLocalId(graph: SceneGraph, propertyIds: readonly string[]): number {
  const ids = [...propertyIds]
  for (const node of graph.nodes.values()) ids.push(node.source.id || node.id)
  for (const [collectionId, collection] of graph.variableCollections) {
    ids.push(collectionId, ...collection.modes.map((mode) => mode.modeId))
    ids.push(...collection.variableIds)
  }
  let last = 0
  for (const id of ids) {
    const guid = parseGuidOrNull(id)
    if (guid && guid.sessionID <= 1) last = Math.max(last, guid.localID)
  }
  return last + 1
}

/** The layer that keeps each GUID as its `source.id`, by GUID. */
function layerSourceOwners(graph: SceneGraph): Map<string, string> {
  const owners = new Map<string, string>()
  for (const node of graph.nodes.values()) if (node.source.id) owners.set(node.source.id, node.id)
  return owners
}

/** The GUIDs layers keep from the file they were read from, which variables must not take. */
export function layerSourceGuids(graph: SceneGraph): Set<string> {
  const guids = new Set<string>()
  for (const node of graph.nodes.values()) {
    if (node.source.id) guids.add(node.source.id)
  }
  return guids
}

export function collectComponentPropertyIds(graph: SceneGraph): string[] {
  const ids = new Set<string>()
  for (const node of graph.getAllNodes()) {
    for (const definition of node.componentPropertyDefinitions) ids.add(definition.id)
    for (const reference of node.componentPropertyReferences) ids.add(reference.propertyId)
    for (const propertyId of Object.keys(node.componentPropertyAssignments)) ids.add(propertyId)
    for (const spec of node.variantPropSpecs) ids.add(spec.propDefId)
  }
  return [...ids]
}

function assignComponentPropertyGuids(
  propertyIds: readonly string[],
  localIdCounter: { value: number },
  propertyIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>,
  nodeSourceGuidValues: Set<string>
): void {
  for (const propertyId of propertyIds) {
    const guid = assignVariableGuid(
      propertyId,
      localIdCounter,
      assignedGuidValues,
      nodeSourceGuidValues
    )
    propertyIdToGuid.set(propertyId, guid)
  }
}

/**
 * Behaviours bind component properties by id, so they follow the ids' new GUIDs. The renamed
 * plugin data is written in place of the node's own; the document keeps its ids.
 */
function renamedBehaviourPluginData(
  graph: SceneGraph,
  propertyIdToGuid: Map<string, GUID>
): Map<string, PluginDataEntry[]> {
  const rename = (propertyId: string) => {
    const guid = propertyIdToGuid.get(propertyId)
    return guid ? `${guid.sessionID}:${guid.localID}` : propertyId
  }
  const renamed = new Map<string, PluginDataEntry[]>()
  for (const node of graph.getAllNodes()) {
    const behaviour = readBehaviour(node)
    if (behaviour)
      renamed.set(node.id, withBehaviour(node, renameBehaviourProperties(behaviour, rename)))
  }
  return renamed
}

function applyImportedCanvasFields(page: FigExportPage, canvasNc: KiwiNodeChange): void {
  if ('backgroundColor' in page.source.fig.rawNodeFields) {
    canvasNc.backgroundColor = structuredClone(page.source.fig.rawNodeFields.backgroundColor)
  }
  if ('backgroundPaints' in page.source.fig.rawNodeFields) {
    canvasNc.backgroundPaints = structuredClone(
      page.source.fig.rawNodeFields.backgroundPaints
    ) as NodeChange['backgroundPaints']
  }
  if (!page.source.id) return
  if (!('pageType' in page.source.fig.rawNodeFields)) delete canvasNc.pageType
  if (page.guides.length > 0) {
    const normalized = exportCanvasGuides(page.guides)
    const raw = page.source.fig.rawNodeFields.guides
    canvasNc.guides =
      Array.isArray(raw) && JSON.stringify(importCanvasGuides(raw)) === JSON.stringify(page.guides)
        ? structuredClone(raw)
        : normalized
  }
  const strokeJoin = page.source.fig.rawNodeFields.strokeJoin
  if (typeof strokeJoin === 'string') canvasNc.strokeJoin = strokeJoin
  const strokeWeight = page.source.fig.rawNodeFields.strokeWeight
  if (typeof strokeWeight === 'number') canvasNc.strokeWeight = strokeWeight
}

function buildCanvasEntries(
  graph: SceneGraph,
  pages: FigExportPage[],
  docGuid: GUID,
  localIdCounter: { value: number },
  nodeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>,
  sourceOwners: ReadonlyMap<string, string>,
  ownGuids = true
): { canvasEntries: CanvasExportEntry[]; internalCanvasGuid: GUID | null } {
  const canvasEntries: CanvasExportEntry[] = []
  let internalCanvasGuid: GUID | null = null
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    const canvasGuid = (() => {
      if (!page.source.id) {
        return (
          (ownGuids ? ownGuid(page.id, sourceOwners, assignedGuidValues) : null) ?? {
            sessionID: 0,
            localID: localIdCounter.value++
          }
        )
      }

      const importedGuid = stringToGuid(page.source.id)
      const key = `${importedGuid.sessionID}:${importedGuid.localID}`

      if (!assignedGuidValues.has(key)) return importedGuid

      return { sessionID: 0, localID: localIdCounter.value++ }
    })()
    // Advance counter past any source.id-derived GUID to prevent collisions
    // with subsequently generated variable/collection GUIDs.
    if (page.source.id && canvasGuid.sessionID === 0) {
      localIdCounter.value = Math.max(localIdCounter.value, canvasGuid.localID + 1)
    }
    nodeIdToGuid.set(page.id, canvasGuid)
    assignedGuidValues.add(`${canvasGuid.sessionID}:${canvasGuid.localID}`)
    if (page.internalOnly) internalCanvasGuid = canvasGuid

    const canvasNc = makeCanvasNodeChange(
      canvasGuid,
      docGuid,
      page.source.orderKey ?? fractionalPosition(p),
      page.name,
      {
        backgroundOpacity: 1,
        backgroundColor: { ...CANVAS_BG_COLOR },
        backgroundEnabled: true
      }
    )
    applyImportedCanvasFields(page, canvasNc)
    if (page.internalOnly) canvasNc.internalOnly = true
    canvasEntries.push({ page, canvasGuid, canvasNc })
  }

  const hasSharedStyles = [...graph.nodes.values()].some((node) => node.sharedStyleType !== null)
  const hasSlotContent = [...graph.nodes.values()].some((node) => ownsSlotContent(graph, node))
  if (
    (graph.variableCollections.size > 0 || hasSharedStyles || hasSlotContent) &&
    internalCanvasGuid === null
  ) {
    internalCanvasGuid = { sessionID: 0, localID: localIdCounter.value++ }
    assignedGuidValues.add(`${internalCanvasGuid.sessionID}:${internalCanvasGuid.localID}`)
    canvasEntries.push({
      page: { id: '', name: 'Internal Only Canvas', internalOnly: true } as FigExportPage,
      canvasGuid: internalCanvasGuid,
      canvasNc: makeCanvasNodeChange(
        internalCanvasGuid,
        docGuid,
        fractionalPosition(canvasEntries.length),
        'Internal Only Canvas',
        { internalOnly: true }
      )
    })
  }

  return { canvasEntries, internalCanvasGuid }
}

/**
 * When the document was imported from a .fig file, preserve the original kiwi schema for both
 * encoding and embedding. Figma's schema has more types and fields than ours, and encoding with
 * ours would produce field IDs that don't align with the embedded schema.
 */
export function exportSchema(graph: SceneGraph): {
  compiled: ReturnType<typeof getCompiledSchema>
  schemaDeflated: Uint8Array
} {
  if (graph.figSchemaDeflated) {
    const schemaBytes = inflateSync(graph.figSchemaDeflated)
    const figSchema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    return {
      compiled: compileSchema(figSchema) as ReturnType<typeof getCompiledSchema>,
      schemaDeflated: graph.figSchemaDeflated
    }
  }
  return { compiled: getCompiledSchema(), schemaDeflated: deflateSync(getSchemaBytes()) }
}

/** GUID maps, caches and canvases one write shares across every record it serializes. */
export interface FigExportSetup {
  graph: SceneGraph
  runtime: FigNodeChangeExportRuntime
  docGuid: GUID
  documentNc: KiwiNodeChange
  localIdCounter: { value: number }
  blobs: Uint8Array[]
  pages: FigExportPage[]
  canvasEntries: CanvasExportEntry[]
  internalCanvasGuid: GUID | null
  nodeIdToGuid: Map<string, GUID>
  assignedGuidValues: Set<string>
  varIdToGuid: Map<string, GUID>
  modeIdToGuid: Map<string, GUID>
  propertyIdToGuid: Map<string, GUID>
  fontDigestMap: Map<string, Uint8Array>
  glyphBlobMap: Map<string, number>
  blobIndexByHex: Map<string, number>
  componentPropertyDefinitionsById: ReturnType<typeof buildComponentPropIndex>
  pluginDataOverrides: ReadonlyMap<string, PluginDataEntry[]>
  recordOwners?: ReadonlyMap<string, string>
}

export interface FigExportSetupOptions {
  /** Saved identities on pages that may not be loaded; new variable IDs must not claim them. */
  archiveRecordIds?: readonly string[]
  /** The first local ID a new GUID may take, above every GUID the target archive holds. */
  nextLocalId?: number
  /** The target archive's blobs, so the indices of new blobs follow theirs. */
  blobs?: Uint8Array[]
  /**
   * The layer each archive GUID belongs to; only that layer writes the archive's record. Writing
   * into an archive preserves new layers' numeric graph IDs when unclaimed across all pages;
   * incompatible or colliding IDs fall back to counter GUIDs past the archive's reserved range.
   */
  recordOwners?: ReadonlyMap<string, string>
  /** Writing into an archive: the variables, collections and modes it holds keep their GUIDs. */
  archiveResourceIds?: ReadonlySet<string>
}

/**
 * The shared state of one write. The last await before the records: after it every record comes
 * from one synchronous pass over the document, and the font digests cover what that pass reads.
 */
export async function prepareFigExport(
  graph: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: FigExportSetupOptions = {}
): Promise<FigExportSetup> {
  const fontDigestMap = await settleFontDigestMap(graph)
  const docGuid = { sessionID: 0, localID: 0 }
  const localIdCounter = { value: 2 }

  const documentNc = makeDocumentNodeChange(docGuid, graph.documentColorSpace)
  const rootNode = graph.getNode(graph.rootId)
  if (rootNode) Object.assign(documentNc, rootNode.source.fig.rawNodeFields)
  applyDocumentPluginData(documentNc, graph)

  const pages = graph.getPages(true)
  const nodeIdToGuid = new Map<string, GUID>()
  const assignedGuidValues = new Set<string>()
  // Reserve the document GUID to prevent imported nodes with source.id "0:0"
  // from reusing the document's own GUID slot.
  assignedGuidValues.add(`${docGuid.sessionID}:${docGuid.localID}`)
  const varIdToGuid = new Map<string, GUID>()
  const modeIdToGuid = new Map<string, GUID>()
  const propertyIdToGuid = new Map<string, GUID>()

  const nodeSourceGuidValues = layerSourceGuids(graph)
  const sourceOwners = layerSourceOwners(graph)
  const archiveRecordIds = new Set(options.archiveRecordIds)
  const propertyIds = collectComponentPropertyIds(graph)
  // Before any canvas, variable or layer takes a counter GUID, so none collides.
  localIdCounter.value = Math.max(
    localIdCounter.value,
    firstUnclaimedLocalId(graph, propertyIds),
    options.nextLocalId ?? 0
  )

  const { canvasEntries, internalCanvasGuid } = buildCanvasEntries(
    graph,
    pages,
    docGuid,
    localIdCounter,
    nodeIdToGuid,
    assignedGuidValues,
    sourceOwners,
    true
  )
  // Archive records keep their GUIDs: claim them before any copy that kept one can.
  for (const [guid, nodeId] of options.recordOwners ?? []) {
    if (nodeIdToGuid.has(nodeId) || !graph.nodes.has(nodeId)) continue
    nodeIdToGuid.set(nodeId, stringToGuid(guid))
    assignedGuidValues.add(guid)
  }

  // Assign variable GUIDs AFTER canvas entries so that source.id-derived
  // canvas GUIDs don't collide with generated variable GUIDs.
  const archived = options.archiveResourceIds
  assignVariableGuids(
    graph,
    localIdCounter,
    varIdToGuid,
    modeIdToGuid,
    assignedGuidValues,
    nodeSourceGuidValues,
    archived
      ? (id) =>
          archived.has(id) ||
          (!archiveRecordIds.has(id) && ownGuid(id, sourceOwners, assignedGuidValues) !== null)
      : undefined
  )

  assignComponentPropertyGuids(
    propertyIds,
    localIdCounter,
    propertyIdToGuid,
    assignedGuidValues,
    nodeSourceGuidValues
  )
  const pluginDataOverrides = renamedBehaviourPluginData(graph, propertyIdToGuid)
  assignOwnLayerGuids(graph, sourceOwners, nodeIdToGuid, assignedGuidValues)

  return {
    graph,
    runtime,
    docGuid,
    documentNc,
    localIdCounter,
    blobs: options.blobs ?? [],
    pages,
    canvasEntries,
    internalCanvasGuid,
    nodeIdToGuid,
    assignedGuidValues,
    varIdToGuid,
    modeIdToGuid,
    propertyIdToGuid,
    fontDigestMap,
    glyphBlobMap: new Map(),
    blobIndexByHex: new Map(),
    componentPropertyDefinitionsById: buildComponentPropIndex(graph),
    pluginDataOverrides,
    recordOwners: options.recordOwners
  }
}

/** The serializer options a setup's records share. */
export function figExportRecordOptions(setup: FigExportSetup) {
  return {
    nodeIdToGuid: setup.nodeIdToGuid,
    fontDigestMap: setup.fontDigestMap,
    varIdToGuid: setup.varIdToGuid,
    glyphBlobMap: setup.glyphBlobMap,
    blobIndexByHex: setup.blobIndexByHex,
    assignedGuidValues: setup.assignedGuidValues,
    componentPropertyDefinitionsById: setup.componentPropertyDefinitionsById,
    modeIdToGuid: setup.modeIdToGuid,
    propertyIdToGuid: setup.propertyIdToGuid,
    pluginDataOverrides: setup.pluginDataOverrides,
    recordOwners: setup.recordOwners,
    runtime: setup.runtime
  }
}

export interface FigFileExtras {
  thumbnailPNG: Uint8Array
  metaJSON: string
  images: Array<{ name: string; data: Uint8Array }>
}

export interface FigFileExtrasOptions {
  ck?: CanvasKit
  renderer?: SkiaRenderer
  /** The page the thumbnail shows; the cover page when absent. */
  pageId?: string
  renderHeadlessThumbnail?: boolean
  /** The name `meta.json` records for the file. */
  documentName?: string
}

/**
 * The thumbnail, metadata and images a written `.fig` carries besides its records, the images
 * under the names `nameImagesForFigma` gave them in those records.
 */
export async function figFileExtras(
  graph: SceneGraph,
  imageNames: ReadonlyMap<string, string>,
  options: FigFileExtrasOptions
): Promise<FigFileExtras> {
  // Internal pages hold library data, not anything a person drew, so the thumbnail skips them.
  const thumbnailPageId = options.pageId ?? figThumbnailPageId(graph.getPages())
  const thumbnail = await renderFigThumbnail(graph, thumbnailPageId, options)
  const metaJSON = figArchiveMetaJSON({
    fileName: options.documentName || UNTITLED_FILE_NAME,
    backgroundColor: getPageColor(thumbnailPageId ? graph.getNode(thumbnailPageId) : undefined),
    thumbnailSize: thumbnail.size,
    renderCoordinates: thumbnail.region,
    exportedAt: new Date()
  })
  return {
    thumbnailPNG: thumbnail.png,
    metaJSON,
    images: figImageEntries(graph.images, imageNames)
  }
}
