import { compressFigDataSync, renameFigArchive } from '@open-pencil/fig'
import {
  nameImagesForFigma,
  placeSlotContent,
  type FigNodeChangeExportRuntime,
  sceneNodeToKiwi
} from '@open-pencil/fig/node-change'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { loadFigDataCompressor, type FigFileKind } from '@open-pencil/kiwi/fig/container'
import type { DocumentKind, SceneGraph } from '@open-pencil/scene-graph'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import { withFigExportRuntime } from '#core/canvas/text/shape'
import { IS_BROWSER } from '#core/constants'
import { figCompressionLevel } from '#core/io/formats/fig/compression'
import { cloneSceneGraphForFigExport } from '#core/kiwi/fig/parse/transfer'
import {
  hasPendingReaderPages,
  populateFigInternalPages,
  populateReaderExport
} from '#core/kiwi/fig/session/document-state'
import { originalFigArchive } from '#core/kiwi/fig/session/original-archive'

import { archiveImagesNamedForFigma, writePatchedFigFile } from './patch'
import {
  exportSchema,
  figExportRecordOptions,
  figFileExtras,
  type FigFileExtrasOptions,
  prepareFigExport,
  type FigExportSetup,
  type KiwiNodeChange
} from './setup'
import { appendVariableNodeChanges, sequentialPositions, assignSharedStyleGuids } from './variables'
import type { CompressResult } from './worker'

type InternalResourceContext = FigExportSetup & { nodeChanges: KiwiNodeChange[] }

/** A `.fig` archive's parts before they are compressed and packed. */
export interface FigArchiveParts {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
  compressionLevel?: number
  documentKind: DocumentKind
}

/** Packs a `.fig` archive from its parts, as a host can do natively off the main thread. */
export type FigArchiveAssembler = (parts: FigArchiveParts) => Promise<Uint8Array>

let hostAssembler: FigArchiveAssembler | null = null

/**
 * Lets the host pack every `.fig` written from now on, as the desktop app does in Rust, since
 * high compression levels take seconds. Without one, a worker packs them, or the main thread
 * where workers are unavailable.
 */
export function setFigArchiveAssembler(assembler: FigArchiveAssembler | null): void {
  hostAssembler = assembler
}

/**
 * Children already written under a canvas. Shared styles, variables and the canvas's own
 * layers all append to the internal canvas from separate passes, so each continues this
 * count rather than numbering from zero and handing siblings the same order key.
 */
function countCanvasChildren(changes: readonly NodeChange[], canvas: GUID): number {
  let count = 0
  for (const change of changes) {
    const parent = change.parentIndex?.guid
    if (parent?.sessionID === canvas.sessionID && parent.localID === canvas.localID) count++
  }
  return count
}

function appendInternalResources(context: InternalResourceContext): void {
  const { graph, internalCanvasGuid, nodeChanges } = context
  if (!internalCanvasGuid) return
  const written = countCanvasChildren(nodeChanges, internalCanvasGuid)
  const sharedStyleNodes = [...graph.nodes.values()].filter((node) => node.sharedStyleType !== null)
  assignSharedStyleGuids(
    sharedStyleNodes,
    context.localIdCounter,
    context.nodeIdToGuid,
    context.assignedGuidValues
  )
  for (let index = 0; index < sharedStyleNodes.length; index++) {
    nodeChanges.push(
      ...sceneNodeToKiwi(
        sharedStyleNodes[index],
        internalCanvasGuid,
        written + index,
        context.localIdCounter,
        graph,
        context.blobs,
        {
          nodeIdToGuid: context.nodeIdToGuid,
          fontDigestMap: context.fontDigestMap,
          varIdToGuid: context.varIdToGuid,
          glyphBlobMap: context.glyphBlobMap,
          blobIndexByHex: context.blobIndexByHex,
          assignedGuidValues: context.assignedGuidValues,
          componentPropertyDefinitionsById: context.componentPropertyDefinitionsById,
          modeIdToGuid: context.modeIdToGuid,
          propertyIdToGuid: context.propertyIdToGuid,
          pluginDataOverrides: context.pluginDataOverrides,
          runtime: context.runtime
        }
      )
    )
  }
  if (graph.variableCollections.size > 0) {
    appendVariableNodeChanges(
      graph,
      nodeChanges,
      internalCanvasGuid,
      context.varIdToGuid,
      context.modeIdToGuid,
      sequentialPositions(written + sharedStyleNodes.length)
    )
  }
}

/**
 * Write `sourceGraph` as a `.fig`. A document opened from an archive and left unchanged is that
 * archive, with only its `meta.json` renamed when `documentName` differs from the name it records.
 */
export async function exportFigFile(
  sourceGraph: SceneGraph,
  options: FigFileExtrasOptions = {}
): Promise<Uint8Array> {
  // An archive whose images Figma cannot read is written whole rather than reused.
  const reuseArchive = await archiveImagesNamedForFigma(sourceGraph)
  const originalArchive = reuseArchive ? await originalFigArchive(sourceGraph) : null
  const reused =
    originalArchive && options.documentName
      ? renameFigArchive(originalArchive, options.documentName)
      : originalArchive
  if (reused) return reused === originalArchive ? reused.slice() : reused
  return withFigExportRuntime(
    sourceGraph,
    options.ck,
    async (runtime) =>
      (reuseArchive ? await writePatchedFigFile(sourceGraph, runtime, options) : null) ??
      writeFigFile(sourceGraph, runtime, options)
  )
}

async function writeFigFile(
  sourceGraph: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: FigFileExtrasOptions
): Promise<Uint8Array> {
  await initCodec()
  populateFigInternalPages(sourceGraph)
  // The export reads the document itself and writes nothing to it. Only pages still in the
  // archive need a copy, which they load into instead of the document.
  let graph = sourceGraph
  if (hasPendingReaderPages(sourceGraph)) {
    graph = cloneSceneGraphForFigExport(sourceGraph)
    populateReaderExport(sourceGraph, graph)
  }
  const setup = await prepareFigExport(graph, runtime)
  const { compiled, schemaDeflated } = exportSchema(graph)
  const { canvasEntries, internalCanvasGuid, localIdCounter, blobs } = setup
  const nodeChanges: KiwiNodeChange[] = [setup.documentNc]
  for (const entry of canvasEntries) nodeChanges.push(entry.canvasNc)

  appendInternalResources({ ...setup, nodeChanges })

  const orderedCanvasEntries = [
    ...canvasEntries.filter((entry) => entry.page.internalOnly),
    ...canvasEntries.filter((entry) => !entry.page.internalOnly)
  ]
  const slotContentRecords: KiwiNodeChange[] = []
  const recordOptions = { ...figExportRecordOptions(setup), slotContentRecords }
  for (const { page, canvasGuid } of orderedCanvasEntries) {
    const children = graph
      .getChildren(page.id)
      .filter((child) => !child.internalOnly && child.sharedStyleType === null)
    const base = countCanvasChildren(nodeChanges, canvasGuid)
    for (let i = 0; i < children.length; i++) {
      nodeChanges.push(
        ...sceneNodeToKiwi(
          children[i],
          canvasGuid,
          base + i,
          localIdCounter,
          graph,
          blobs,
          recordOptions
        )
      )
    }
  }
  if (internalCanvasGuid) {
    const first = countCanvasChildren(nodeChanges, internalCanvasGuid)
    placeSlotContent(slotContentRecords, internalCanvasGuid, first, fractionalPosition)
    nodeChanges.push(...slotContentRecords)
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

  const imageNames = nameImagesForFigma(nodeChanges, graph.images)
  const kiwiData = compiled.encodeMessage(msg)
  const extras = await figFileExtras(graph, imageNames, options)

  const version = graph.figKiwiVersion ?? undefined
  const compressionLevel = figCompressionLevel(sourceGraph)

  if (hostAssembler) {
    return hostAssembler({
      schemaDeflated,
      kiwiData,
      thumbnailPNG: extras.thumbnailPNG,
      metaJSON: extras.metaJSON,
      images: extras.images,
      figKiwiVersion: version,
      compressionLevel,
      documentKind: graph.documentKind
    })
  }

  return compressFigData(
    schemaDeflated,
    kiwiData,
    extras.thumbnailPNG,
    extras.metaJSON,
    extras.images,
    version,
    compressionLevel,
    graph.documentKind
  )
}

export type { FigFileExtrasOptions }

function canUseWorker(): boolean {
  return typeof Worker !== 'undefined' && IS_BROWSER
}

/** Compresses in a worker; it takes what `compressFigData` takes. */
function compressViaWorker(...args: Parameters<typeof compressFigData>): Promise<Uint8Array> {
  const [
    schemaDeflated,
    kiwiData,
    thumbnailPNG,
    metaJSON,
    imageEntries,
    figKiwiVersion,
    compressionLevel,
    kind
  ] = args
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e: MessageEvent<CompressResult>) => {
      if (e.data instanceof Uint8Array) resolve(e.data)
      else reject(new Error(e.data.error))
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
      thumbnailPNG,
      metaJSON,
      images: imageEntries,
      figKiwiVersion,
      compressionLevel,
      kind
    })
  })
}

/** Assemble a `.fig` archive with its document data compressed at `compressionLevel` (zstd). */
export async function compressFigData(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPNG: Uint8Array,
  metaJSON: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>,
  figKiwiVersion?: number,
  compressionLevel?: number,
  kind?: FigFileKind
): Promise<Uint8Array> {
  if (canUseWorker()) {
    return compressViaWorker(
      schemaDeflated,
      kiwiData,
      thumbnailPNG,
      metaJSON,
      imageEntries,
      figKiwiVersion,
      compressionLevel,
      kind
    )
  }
  return compressFigDataSync(
    schemaDeflated,
    kiwiData,
    thumbnailPNG,
    metaJSON,
    imageEntries,
    figKiwiVersion,
    await loadFigDataCompressor(compressionLevel),
    kind
  )
}
