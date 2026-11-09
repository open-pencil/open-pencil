import {
  compressFigDataSync,
  renameFigArchive,
  renameFigArchiveStream,
  writeFigArchiveStream
} from '@open-pencil/fig'
import {
  nameImagesForFigma,
  placeSlotContent,
  type FigNodeChangeExportRuntime,
  sceneNodeToKiwi
} from '@open-pencil/fig/node-change'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  buildFigKiwi,
  loadFigDataCompressor,
  type FigFileKind
} from '@open-pencil/kiwi/fig/container'
import type { DocumentKind, SceneGraph } from '@open-pencil/scene-graph'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import { IS_BROWSER } from '#core/constants'
import { figCompressionLevel } from '#core/io/formats/fig/compression'
import { cloneSceneGraphForFigExport } from '#core/kiwi/fig/parse/transfer'
import {
  hasPendingReaderPages,
  populateFigInternalPages,
  populateReaderExport
} from '#core/kiwi/fig/session/document-state'
import { originalFigArchive } from '#core/kiwi/fig/session/original-archive'

import { archiveImagesNamedForFigma, writePatchedFigFile, writePatchedFigFileStream } from './patch'
import { withFigExportRuntime } from './runtime'
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

/** The document data a `.fig` save compresses into its `canvas.fig` entry. */
export interface FigCanvasParts {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  figKiwiVersion?: number
  compressionLevel?: number
  documentKind: DocumentKind
}

/** Compresses `canvas.fig` natively or off the main thread; no image bytes cross this boundary. */
export type FigCanvasCompressor = (parts: FigCanvasParts) => Promise<Uint8Array>

/** Where an archive is written: called once per chunk, and may be async to apply backpressure. */
export type FigArchiveSink = (chunk: Uint8Array) => void | Promise<void>

export interface FigFileStreamOptions extends FigFileExtrasOptions {
  onProgress?: (written: number, total: number) => void
}

let hostAssembler: FigArchiveAssembler | null = null
let canvasCompressor: FigCanvasCompressor | null = null

/**
 * Lets the host pack every `.fig` written from now on, as the desktop app did in Rust, since
 * high compression levels take seconds. Without one, a worker packs them, or the main thread
 * where workers are unavailable. Saves that stream use `setFigCanvasCompressor` instead.
 */
export function setFigArchiveAssembler(assembler: FigArchiveAssembler | null): void {
  hostAssembler = assembler
}

/**
 * Lets the host compress the document data of every streamed `.fig` save. The desktop app uses
 * this so image bytes never travel through IPC: only `schemaDeflated` and `kiwiData` do.
 */
export function setFigCanvasCompressor(compressor: FigCanvasCompressor | null): void {
  canvasCompressor = compressor
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
          propertyCopyGuids: context.propertyCopyGuids,
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
  // A host that packs whole archives keeps doing so; a streaming save never hands it images.
  if (hostAssembler) {
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
  const chunks: Uint8Array[] = []
  await exportFigFileStream(
    sourceGraph,
    (chunk) => {
      chunks.push(chunk)
    },
    options
  )
  return concatenateBytes(chunks)
}

/** The bytes a streamed export produced, joined into the one buffer a byte-returning caller needs. */
export function concatenateBytes(chunks: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const chunk of chunks) length += chunk.byteLength
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function writeBytesToSink(
  bytes: Uint8Array,
  sink: FigArchiveSink,
  onProgress?: (written: number, total: number) => void
): Promise<void> {
  const chunkBytes = 1024 * 1024
  for (let offset = 0; offset < bytes.byteLength; offset += chunkBytes) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkBytes, bytes.byteLength))
    await sink(chunk)
    onProgress?.(Math.min(offset + chunk.byteLength, bytes.byteLength), bytes.byteLength)
  }
}

/**
 * Write `sourceGraph` into `sink` as a `.fig`, a chunk at a time. An unchanged archive opened from
 * disk is copied entry by entry; a changed one patches only its records; a document with no
 * archive is written whole. The archive is never assembled in memory, so the save's peak follows
 * its largest image rather than its total size.
 */
export async function exportFigFileStream(
  sourceGraph: SceneGraph,
  sink: FigArchiveSink,
  options: FigFileStreamOptions = {}
): Promise<void> {
  const reuseArchive = await archiveImagesNamedForFigma(sourceGraph)
  const originalArchive = reuseArchive ? await originalFigArchive(sourceGraph) : null
  if (originalArchive) {
    if (!options.documentName) {
      await writeBytesToSink(originalArchive, sink, options.onProgress)
      return
    }
    if (
      await renameFigArchiveStream(originalArchive, options.documentName, sink, {
        onProgress: options.onProgress
      })
    )
      return
  }
  await withFigExportRuntime(sourceGraph, options.ck, async (runtime) => {
    if (reuseArchive && (await writePatchedFigFileStream(sourceGraph, runtime, options, sink)))
      return
    await writeFigFileStream(sourceGraph, runtime, options, sink)
  })
}

async function buildFigParts(
  sourceGraph: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: FigFileExtrasOptions
): Promise<FigArchiveParts> {
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

  return {
    schemaDeflated,
    kiwiData,
    thumbnailPNG: extras.thumbnailPNG,
    metaJSON: extras.metaJSON,
    images: extras.images,
    figKiwiVersion: version,
    compressionLevel,
    documentKind: graph.documentKind
  }
}

async function writeFigFile(
  sourceGraph: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: FigFileExtrasOptions
): Promise<Uint8Array> {
  const parts = await buildFigParts(sourceGraph, runtime, options)
  if (hostAssembler) return hostAssembler(parts)
  return compressFigData(
    parts.schemaDeflated,
    parts.kiwiData,
    parts.thumbnailPNG,
    parts.metaJSON,
    parts.images,
    parts.figKiwiVersion,
    parts.compressionLevel,
    parts.documentKind
  )
}

async function writeFigFileStream(
  sourceGraph: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: FigFileStreamOptions,
  sink: FigArchiveSink
): Promise<void> {
  const parts = await buildFigParts(sourceGraph, runtime, options)
  const canvasFig = await compressFigCanvas(parts)
  await writeFigArchiveStream(
    {
      canvasFig,
      thumbnailPNG: parts.thumbnailPNG,
      metaJSON: parts.metaJSON,
      images: parts.images
    },
    sink,
    { onProgress: options.onProgress }
  )
}

function buildFigCanvas(parts: FigCanvasParts, compress: (data: Uint8Array) => Uint8Array) {
  return buildFigKiwi(
    parts.schemaDeflated,
    parts.kiwiData,
    parts.figKiwiVersion,
    compress,
    parts.documentKind === 'board' ? 'board' : 'design'
  )
}

async function compressFigCanvas(parts: FigCanvasParts): Promise<Uint8Array> {
  if (canvasCompressor) return canvasCompressor(parts)
  if (canUseWorker()) return compressCanvasViaWorker(parts)
  return buildFigCanvas(parts, await loadFigDataCompressor(parts.compressionLevel))
}

export type { FigFileExtrasOptions }

function canUseWorker(): boolean {
  return typeof Worker !== 'undefined' && IS_BROWSER
}

/** Compresses only `canvas.fig` in a worker, so no image byte is cloned across. */
function compressCanvasViaWorker(parts: FigCanvasParts): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<CompressResult>) => {
      if (event.data instanceof Uint8Array) resolve(event.data)
      else reject(new Error(event.data.error))
      worker.terminate()
    }
    worker.onerror = (error) => {
      reject(new Error(error.message))
      worker.terminate()
    }
    worker.postMessage({
      kind: 'canvas',
      schemaDeflated: parts.schemaDeflated,
      kiwiData: parts.kiwiData,
      figKiwiVersion: parts.figKiwiVersion,
      compressionLevel: parts.compressionLevel,
      fileKind: parts.documentKind
    })
  })
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
