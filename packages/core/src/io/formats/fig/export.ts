import type { CanvasKit } from 'canvaskit-wasm'
import { deflateSync, inflateSync } from 'fflate'

import { initCodec, getCompiledSchema, getSchemaBytes } from '@open-pencil/kiwi/fig/codec'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'
import type { SceneGraph, VariableValue } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import { CANVAS_BG_COLOR, IS_BROWSER, IS_TAURI } from '#core/constants'
import { renderThumbnail } from '#core/io/formats/raster'
import { populateAllLazyFigImportRoots } from '#core/kiwi/fig/lazy-import'
import { stringToGuid } from '#core/kiwi/fig/node-change/convert'
import {
  sceneNodeToKiwi,
  fractionalPosition,
  buildFontDigestMap,
  safeColor,
  makeDocumentNodeChange,
  makeCanvasNodeChange
} from '#core/kiwi/fig/node-change/serialize'

import { compressFigDataSync } from './compress'

const THUMBNAIL_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

type KiwiNodeChange = NodeChange & Record<string, unknown>
type FigExportPage = ReturnType<SceneGraph['getPages']>[number]

interface CanvasExportEntry {
  page: FigExportPage
  canvasGuid: GUID
  canvasNc: KiwiNodeChange
}

function variableValueToKiwi(
  value: VariableValue,
  type: string,
  varIdToGuid: Map<string, GUID>
): { value: Record<string, unknown>; dataType: string; resolvedDataType: string } {
  if (value && typeof value === 'object' && 'aliasId' in value) {
    const aliasGuid = varIdToGuid.get(value.aliasId) ?? stringToGuid(value.aliasId)
    return {
      value: { alias: { guid: aliasGuid } },
      dataType: 'ALIAS',
      resolvedDataType: { COLOR: 'COLOR', BOOLEAN: 'BOOLEAN', STRING: 'STRING' }[type] ?? 'FLOAT'
    }
  }
  if (type === 'COLOR' && typeof value === 'object' && 'r' in value) {
    return {
      value: { colorValue: safeColor(value) },
      dataType: 'COLOR',
      resolvedDataType: 'COLOR'
    }
  }
  if (type === 'BOOLEAN') {
    return { value: { boolValue: !!value }, dataType: 'BOOLEAN', resolvedDataType: 'BOOLEAN' }
  }
  if (type === 'STRING') {
    return {
      value: { textValue: typeof value === 'string' ? value : JSON.stringify(value) },
      dataType: 'STRING',
      resolvedDataType: 'STRING'
    }
  }
  return { value: { floatValue: Number(value) }, dataType: 'FLOAT', resolvedDataType: 'FLOAT' }
}

function collectImageEntries(graph: SceneGraph): Array<{ name: string; data: Uint8Array }> {
  const entries: Array<{ name: string; data: Uint8Array }> = []
  for (const [hash, data] of graph.images) {
    entries.push({ name: `images/${hash}`, data })
  }
  return entries
}

const THUMBNAIL_WIDTH = 400
const THUMBNAIL_HEIGHT = 225

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

function assignVariableGuids(
  graph: SceneGraph,
  localIdCounter: { value: number },
  varIdToGuid: Map<string, GUID>,
  modeIdToGuid: Map<string, GUID>,
  assignedGuidValues: Set<string>
): void {
  for (const [colId, col] of graph.variableCollections) {
    const colGuid = { sessionID: 0, localID: localIdCounter.value++ }
    varIdToGuid.set(colId, colGuid)
    assignedGuidValues.add(`${colGuid.sessionID}:${colGuid.localID}`)
    for (const mode of col.modes) {
      const modeGuid = { sessionID: 0, localID: localIdCounter.value++ }
      modeIdToGuid.set(mode.modeId, modeGuid)
      assignedGuidValues.add(`${modeGuid.sessionID}:${modeGuid.localID}`)
    }
    for (const varId of col.variableIds) {
      const varGuid = { sessionID: 0, localID: localIdCounter.value++ }
      varIdToGuid.set(varId, varGuid)
      assignedGuidValues.add(`${varGuid.sessionID}:${varGuid.localID}`)
    }
  }
}

function appendVariableNodeChanges(
  graph: SceneGraph,
  nodeChanges: KiwiNodeChange[],
  internalCanvasGuid: GUID,
  varIdToGuid: Map<string, GUID>,
  modeIdToGuid: Map<string, GUID>
): void {
  let collIdx = 0
  for (const [colId, col] of graph.variableCollections) {
    const colGuid = varIdToGuid.get(colId) ?? stringToGuid(colId)
    nodeChanges.push({
      guid: colGuid,
      parentIndex: { guid: internalCanvasGuid, position: fractionalPosition(collIdx++) },
      type: 'VARIABLE_SET',
      name: col.name,
      phase: 'CREATED',
      strokeAlign: 'CENTER',
      strokeJoin: 'BEVEL',
      variableSetModes: col.modes.map((m, i) => {
        const mGuid = modeIdToGuid.get(m.modeId) ?? stringToGuid(m.modeId)
        return { id: mGuid, name: m.name, sortPosition: fractionalPosition(i) }
      })
    })

    appendVariablesForCollection(
      graph,
      nodeChanges,
      colGuid,
      internalCanvasGuid,
      col.variableIds,
      varIdToGuid,
      modeIdToGuid
    )
  }
}

function appendVariablesForCollection(
  graph: SceneGraph,
  nodeChanges: KiwiNodeChange[],
  colGuid: GUID,
  parentGuid: GUID,
  variableIds: string[],
  varIdToGuid: Map<string, GUID>,
  modeIdToGuid: Map<string, GUID>
): void {
  let varIdx = 0
  for (const varId of variableIds) {
    const variable = graph.variables.get(varId)
    if (!variable) continue

    const varGuid = varIdToGuid.get(varId) ?? stringToGuid(varId)
    const typeMap: Record<string, string> = {
      COLOR: 'COLOR',
      BOOLEAN: 'BOOLEAN',
      STRING: 'STRING'
    }
    const resolvedType = typeMap[variable.type] ?? 'FLOAT'

    const entries = Object.entries(variable.valuesByMode).map(([modeId, value]) => ({
      modeID: modeIdToGuid.get(modeId) ?? stringToGuid(modeId),
      variableData: variableValueToKiwi(value, variable.type, varIdToGuid)
    }))

    const nc: KiwiNodeChange = {
      guid: varGuid,
      parentIndex: { guid: parentGuid, position: fractionalPosition(varIdx++) },
      type: 'VARIABLE',
      name: variable.name,
      phase: 'CREATED',
      strokeAlign: 'CENTER',
      strokeJoin: 'BEVEL',
      variableSetID: { guid: colGuid },
      variableResolvedType: resolvedType,
      variableDataValues: { entries },
      variableScopes: ['ALL_SCOPES']
    }
    // Preserve library key/version on VARIABLE NodeChanges so that
    // buildAssetRefMap can resolve assetRef to guid on reimport.
    if (variable.key) nc.key = variable.key
    if (variable.version) nc.version = variable.version
    nodeChanges.push(nc)
  }
}

function applyImportedCanvasFields(page: FigExportPage, canvasNc: KiwiNodeChange): void {
  // Page color applies to OpenPencil-authored pages too (setPageColor writes
  // it) — never gate it behind an imported source id.
  if ('backgroundColor' in page.source.fig.rawNodeFields) {
    canvasNc.backgroundColor = structuredClone(page.source.fig.rawNodeFields.backgroundColor)
  }
  if (!page.source.id) return
  if (!('pageType' in page.source.fig.rawNodeFields)) delete canvasNc.pageType
  if ('backgroundPaints' in page.source.fig.rawNodeFields) {
    canvasNc.backgroundPaints = structuredClone(
      page.source.fig.rawNodeFields.backgroundPaints
    ) as NodeChange['backgroundPaints']
  }
  if ('guides' in page.source.fig.rawNodeFields) {
    canvasNc.guides = structuredClone(page.source.fig.rawNodeFields.guides)
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
  assignedGuidValues: Set<string>
): { canvasEntries: CanvasExportEntry[]; internalCanvasGuid: GUID | null } {
  const canvasEntries: CanvasExportEntry[] = []
  let internalCanvasGuid: GUID | null = null
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]
    const canvasGuid = (() => {
      if (!page.source.id) return { sessionID: 0, localID: localIdCounter.value++ }

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

  if (graph.variableCollections.size > 0 && internalCanvasGuid === null) {
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

export async function exportFigFile(
  graph: SceneGraph,
  ck?: CanvasKit,
  renderer?: SkiaRenderer,
  pageId?: string,
  renderHeadlessThumbnail = false
): Promise<Uint8Array> {
  populateAllLazyFigImportRoots(graph)
  await initCodec()

  // When the document was imported from a .fig file, preserve the original
  // kiwi schema for both encoding and embedding. For the current version of
  // Figma, likely for quite some time, schema has more types/fields than our
  // subset, and using our schema to encode would produce field IDs that don't
  // align with the embedded schema. By compiling and using the original
  // schema, we improve the roundtrip-ability... This requires further work.
  let compiled: ReturnType<typeof getCompiledSchema>
  let schemaDeflated: Uint8Array
  if (graph.figSchemaDeflated) {
    const schemaBytes = inflateSync(graph.figSchemaDeflated)
    const figSchema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    compiled = compileSchema(figSchema) as ReturnType<typeof getCompiledSchema>
    schemaDeflated = graph.figSchemaDeflated
  } else {
    compiled = getCompiledSchema()
    schemaDeflated = deflateSync(getSchemaBytes())
  }

  const docGuid = { sessionID: 0, localID: 0 }
  const localIdCounter = { value: 2 }

  const documentNc = makeDocumentNodeChange(docGuid, graph.documentColorSpace)
  const rootNode = graph.getNode(graph.rootId)
  if (rootNode) Object.assign(documentNc, rootNode.source.fig.rawNodeFields)
  const nodeChanges: KiwiNodeChange[] = [documentNc]

  const blobs: Uint8Array[] = []
  const pages = graph.getPages(true)
  const nodeIdToGuid = new Map<string, GUID>()
  const assignedGuidValues = new Set<string>()
  // Reserve the document GUID to prevent imported nodes with source.id "0:0"
  // from reusing the document's own GUID slot.
  assignedGuidValues.add(`${docGuid.sessionID}:${docGuid.localID}`)
  const varIdToGuid = new Map<string, GUID>()
  const modeIdToGuid = new Map<string, GUID>()
  const fontDigestMap = await buildFontDigestMap(graph)
  const glyphBlobMap = new Map<string, number>()
  const blobIndexByHex = new Map<string, number>()

  // Scan ALL imported source.ids BEFORE any new GUID assignment to find
  // max sessionID:0 and sessionID:1 localID values. This guarantees the
  // counter is past every imported GUID before any canvas, variable, or
  // node claims a new counter-based GUID — preventing collisions.
  let maxLocalId0 = localIdCounter.value - 1
  let maxLocalId1 = localIdCounter.value - 1
  for (const node of graph.nodes.values()) {
    if (node.source.id) {
      const g = stringToGuid(node.source.id)
      if (g.sessionID === 0 && g.localID > maxLocalId0) {
        maxLocalId0 = g.localID
      }
      if (g.sessionID === 1 && g.localID > maxLocalId1) {
        maxLocalId1 = g.localID
      }
    }
  }
  localIdCounter.value = Math.max(localIdCounter.value, maxLocalId0 + 1, maxLocalId1 + 1)

  const { canvasEntries, internalCanvasGuid } = buildCanvasEntries(
    graph,
    pages,
    docGuid,
    localIdCounter,
    nodeIdToGuid,
    assignedGuidValues
  )

  // Assign variable GUIDs AFTER canvas entries so that source.id-derived
  // canvas GUIDs don't collide with generated variable GUIDs.
  assignVariableGuids(graph, localIdCounter, varIdToGuid, modeIdToGuid, assignedGuidValues)

  for (const entry of canvasEntries) nodeChanges.push(entry.canvasNc)

  const orderedCanvasEntries = [
    ...canvasEntries.filter((entry) => entry.page.internalOnly),
    ...canvasEntries.filter((entry) => !entry.page.internalOnly)
  ]
  for (const { page, canvasGuid } of orderedCanvasEntries) {
    const children = graph.getChildren(page.id).filter((child) => !child.internalOnly)
    for (let i = 0; i < children.length; i++) {
      nodeChanges.push(
        ...sceneNodeToKiwi(
          children[i],
          canvasGuid,
          i,
          localIdCounter,
          graph,
          blobs,
          nodeIdToGuid,
          fontDigestMap,
          varIdToGuid,
          glyphBlobMap,
          blobIndexByHex,
          assignedGuidValues
        )
      )
    }
  }

  if (graph.variableCollections.size > 0 && internalCanvasGuid) {
    appendVariableNodeChanges(graph, nodeChanges, internalCanvasGuid, varIdToGuid, modeIdToGuid)
  }

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges
  }

  if (blobs.length > 0) {
    msg.blobs = blobs.map((bytes) => ({ bytes }))
  }

  const kiwiData = compiled.encodeMessage(msg)

  const currentPageId = pageId ?? pages[0]?.id
  const thumbnailPng = await renderFigThumbnail(
    graph,
    currentPageId,
    ck,
    renderer,
    renderHeadlessThumbnail
  )

  const metaJson = JSON.stringify({
    version: 1,
    app: 'OpenPencil',
    createdAt: new Date().toISOString()
  })

  const imageEntries = collectImageEntries(graph)

  const version = graph.figKiwiVersion ?? undefined

  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core')
    return new Uint8Array(
      await invoke<number[]>('build_fig_file', {
        schemaDeflated: Array.from(schemaDeflated),
        kiwiData: Array.from(kiwiData),
        thumbnailPng: Array.from(thumbnailPng),
        metaJson,
        images: imageEntries.map((e) => ({ name: e.name, data: Array.from(e.data) })),
        figKiwiVersion: version
      })
    )
  }

  return compressFigData(schemaDeflated, kiwiData, thumbnailPng, metaJson, imageEntries, version)
}

export { compressFigDataSync } from './compress'

function canUseWorker(): boolean {
  return typeof Worker !== 'undefined' && IS_BROWSER
}

function compressViaWorker(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPng: Uint8Array,
  metaJson: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>,
  figKiwiVersion?: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./export-worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e: MessageEvent<Uint8Array>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (err) => {
      reject(new Error(err.message))
      worker.terminate()
    }

    // Do NOT use transferables here. toUint8Array() in ByteBuffer returns a view of the
    // internal buffer, so transferring kiwiData.buffer or schemaDeflated.buffer detaches
    // buffers that may be shared with other views, causing "already detached" errors on
    // subsequent saves. Structured clone (the default) copies the data safely.
    worker.postMessage({
      schemaDeflated,
      kiwiData,
      thumbnailPng,
      metaJson,
      images: imageEntries,
      figKiwiVersion
    })
  })
}

export function compressFigData(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPng: Uint8Array,
  metaJson: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>,
  figKiwiVersion?: number
): Promise<Uint8Array> {
  if (canUseWorker()) {
    return compressViaWorker(
      schemaDeflated,
      kiwiData,
      thumbnailPng,
      metaJson,
      imageEntries,
      figKiwiVersion
    )
  }
  return Promise.resolve(
    compressFigDataSync(
      schemaDeflated,
      kiwiData,
      thumbnailPng,
      metaJson,
      imageEntries,
      figKiwiVersion
    )
  )
}
