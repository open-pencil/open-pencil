import type { CanvasKit } from 'canvaskit-wasm'
import { deflateSync, inflateSync } from 'fflate'
import { toUint8Array } from 'js-base64'

import {
  buildComponentPropIndex,
  exportCanvasGuides,
  importCanvasGuides,
  stringToGuid,
  type FigNodeChangeExportRuntime
} from '@open-pencil/fig/node-change'
import { getCompiledSchema, getSchemaBytes } from '@open-pencil/kiwi/fig/codec'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'
import {
  ownsSlotContent,
  readBehaviour,
  renameBehaviourProperties,
  withBehaviour,
  type PluginDataEntry,
  type SceneGraph
} from '@open-pencil/scene-graph'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import { CANVAS_BG_COLOR, IS_BROWSER, IS_TAURI } from '#core/constants'
import { applyEnabledLibrariesPluginData } from '#core/io/formats/fig/library-metadata'
import { findFigThumbnailPageId } from '#core/io/formats/fig/thumbnail-page'
import { renderThumbnail } from '#core/io/formats/raster'
import {
  makeCanvasNodeChange,
  makeDocumentNodeChange,
  settleFontDigestMap
} from '#core/kiwi/fig/node-change/serialize'

import { assignVariableGuid, assignVariableGuids } from './variable-export'

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

function collectImageEntries(graph: SceneGraph): Array<{ name: string; data: Uint8Array }> {
  const entries: Array<{ name: string; data: Uint8Array }> = []
  for (const [hash, data] of graph.images) {
    entries.push({ name: `images/${hash}`, data })
  }
  return entries
}

const THUMBNAIL_WIDTH = 512
const THUMBNAIL_HEIGHT = 512

async function renderFigThumbnail(
  graph: SceneGraph,
  pageId: string | undefined,
  ck?: CanvasKit,
  renderer?: SkiaRenderer,
  renderHeadless = false
): Promise<Uint8Array> {
  if (!pageId) return THUMBNAIL_1X1
  if (ck && renderer) {
    return (
      renderThumbnail(ck, renderer, graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT) ??
      THUMBNAIL_1X1
    )
  }
  if (!renderHeadless || IS_BROWSER || IS_TAURI) return THUMBNAIL_1X1
  const { headlessRenderThumbnail } = await import('#core/io/formats/raster')
  return (
    (await headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)) ??
    THUMBNAIL_1X1
  )
}

/**
 * The GUID a layer that was never opened from a file is saved under: its graph ID, which has
 * Figma's `sessionID:localID` shape and never changes, so later saves keep it. Saved GUIDs of
 * opened layers and GUIDs already written win over it.
 */
function ownGuid(
  id: string,
  sourceGuidValues: ReadonlySet<string>,
  assignedGuidValues: ReadonlySet<string>
): GUID | null {
  if (!/^\d+:\d+$/.test(id)) return null
  const guid = stringToGuid(id)
  const key = `${guid.sessionID}:${guid.localID}`
  return sourceGuidValues.has(key) || assignedGuidValues.has(key) ? null : guid
}

function assignOwnLayerGuids(
  graph: SceneGraph,
  sourceGuidValues: ReadonlySet<string>,
  nodeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>
): void {
  for (const node of graph.nodes.values()) {
    if (node.source.id || node.id === graph.rootId || nodeIdToGuid.has(node.id)) continue
    const guid = ownGuid(node.id, sourceGuidValues, assignedGuidValues)
    if (!guid) continue
    nodeIdToGuid.set(node.id, guid)
    assignedGuidValues.add(`${guid.sessionID}:${guid.localID}`)
  }
}

/**
 * The first local ID the counter can mint in sessions 0 and 1: past every saved GUID and every
 * ID that layers, collections, modes, variables and component properties are saved under.
 */
function firstUnclaimedLocalId(graph: SceneGraph, propertyIds: readonly string[]): number {
  const ids = [...propertyIds]
  for (const node of graph.nodes.values()) ids.push(node.source.id || node.id)
  for (const [collectionId, collection] of graph.variableCollections) {
    ids.push(collectionId, ...collection.modes.map((mode) => mode.modeId))
    ids.push(...collection.variableIds)
  }
  let last = 0
  for (const id of ids) {
    if (!/^\d+:\d+$/.test(id)) continue
    const guid = stringToGuid(id)
    if (guid.sessionID <= 1) last = Math.max(last, guid.localID)
  }
  return last + 1
}

function collectComponentPropertyIds(graph: SceneGraph): string[] {
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
  sourceGuidValues: ReadonlySet<string>,
  ownGuids = true
): { canvasEntries: CanvasExportEntry[]; internalCanvasGuid: GUID | null } {
  const canvasEntries: CanvasExportEntry[] = []
  let internalCanvasGuid: GUID | null = null
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    const canvasGuid = (() => {
      if (!page.source.id) {
        return (
          (ownGuids ? ownGuid(page.id, sourceGuidValues, assignedGuidValues) : null) ?? {
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
  /** The first local ID a new GUID may take, above every GUID the target archive holds. */
  nextLocalId?: number
  /** The target archive's blobs, so the indices of new blobs follow theirs. */
  blobs?: Uint8Array[]
  /**
   * The layer each archive GUID belongs to; only that layer writes the archive's record. Writing
   * into an archive also gives new layers and pages counter GUIDs, past every GUID it holds,
   * rather than their graph IDs, which a record on a page not loaded may already use.
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
  applyEnabledLibrariesPluginData(documentNc, graph)

  const pages = graph.getPages(true)
  const nodeIdToGuid = new Map<string, GUID>()
  const assignedGuidValues = new Set<string>()
  // Reserve the document GUID to prevent imported nodes with source.id "0:0"
  // from reusing the document's own GUID slot.
  assignedGuidValues.add(`${docGuid.sessionID}:${docGuid.localID}`)
  const varIdToGuid = new Map<string, GUID>()
  const modeIdToGuid = new Map<string, GUID>()
  const propertyIdToGuid = new Map<string, GUID>()

  const nodeSourceGuidValues = new Set<string>()
  for (const node of graph.nodes.values()) {
    if (node.source.id) nodeSourceGuidValues.add(node.source.id)
  }
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
    nodeSourceGuidValues,
    !options.recordOwners
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
    archived ? (id) => archived.has(id) : undefined
  )

  assignComponentPropertyGuids(
    propertyIds,
    localIdCounter,
    propertyIdToGuid,
    assignedGuidValues,
    nodeSourceGuidValues
  )
  const pluginDataOverrides = renamedBehaviourPluginData(graph, propertyIdToGuid)
  if (!options.recordOwners)
    assignOwnLayerGuids(graph, nodeSourceGuidValues, nodeIdToGuid, assignedGuidValues)

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

/** The thumbnail, metadata and images a written `.fig` carries besides its records. */
export async function figFileExtras(
  graph: SceneGraph,
  pageId: string | undefined,
  ck: CanvasKit | undefined,
  renderer: SkiaRenderer | undefined,
  renderHeadlessThumbnail: boolean
): Promise<FigFileExtras> {
  const currentPageId = pageId ?? findFigThumbnailPageId(graph.getPages(true))
  const thumbnailPNG = await renderFigThumbnail(
    graph,
    currentPageId,
    ck,
    renderer,
    renderHeadlessThumbnail
  )
  const metaJSON = JSON.stringify({
    version: 1,
    app: 'OpenPencil',
    createdAt: new Date().toISOString()
  })
  return { thumbnailPNG, metaJSON, images: collectImageEntries(graph) }
}
