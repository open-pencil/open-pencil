import { bytesStream, readStreamBytes, renameFigArchive, streamFigArchive } from '@open-pencil/fig'
import {
  nameImagesForFigma,
  placeSlotContent,
  type FigNodeChangeExportRuntime,
  sceneNodeToKiwi
} from '@open-pencil/fig/node-change'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { appendAll } from '@open-pencil/scene-graph/arrays'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import { figCompressionLevel } from '#core/io/formats/fig/compression'
import { cloneSceneGraphForFigExport } from '#core/kiwi/fig/parse/transfer'
import {
  hasPendingReaderPages,
  populateFigInternalPages,
  populateReaderExport
} from '#core/kiwi/fig/session/document-state'
import { originalFigArchive } from '#core/kiwi/fig/session/original-archive'

import { compressFigCanvas } from './compress'
import { archiveImagesNamedForFigma, writePatchedFigFile } from './patch'
import { withFigExportRuntime } from './runtime'
import {
  exportSchema,
  figExportRecordOptions,
  type FigExportSetup,
  figFileExtras,
  type FigFileExtrasOptions,
  type KiwiNodeChange,
  prepareFigExport
} from './setup'
import { appendVariableNodeChanges, sequentialPositions, assignSharedStyleGuids } from './variables'

type InternalResourceContext = FigExportSetup & { nodeChanges: KiwiNodeChange[] }

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
    appendAll(
      nodeChanges,
      sceneNodeToKiwi(
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
 * `sourceGraph` as a `.fig`, written as the stream's reader asks for it. A document opened from an
 * archive and left unchanged is that archive, with only its `meta.json` renamed when
 * `documentName` differs from the name it records; a changed one is that archive with its changed
 * records patched in. The document data is encoded and compressed before this returns, and the
 * images then pass through as views, so the archive is never held whole.
 */
export async function exportFigFileStream(
  sourceGraph: SceneGraph,
  options: FigFileExtrasOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  // An archive whose images Figma cannot read is written whole rather than reused.
  const reuseArchive = await archiveImagesNamedForFigma(sourceGraph)
  const originalArchive = reuseArchive ? await originalFigArchive(sourceGraph) : null
  if (originalArchive) {
    const reused = options.documentName
      ? renameFigArchive(originalArchive, options.documentName)
      : bytesStream(originalArchive)
    if (reused) return reused
  }
  return withFigExportRuntime(
    sourceGraph,
    options.ck,
    async (runtime) =>
      (reuseArchive ? await writePatchedFigFile(sourceGraph, runtime, options) : null) ??
      writeFigFile(sourceGraph, runtime, options)
  )
}

/** `exportFigFileStream` read into one buffer, for callers that need the whole file. */
export async function exportFigFile(
  sourceGraph: SceneGraph,
  options: FigFileExtrasOptions = {}
): Promise<Uint8Array> {
  return readStreamBytes(await exportFigFileStream(sourceGraph, options))
}

async function writeFigFile(
  sourceGraph: SceneGraph,
  runtime: FigNodeChangeExportRuntime,
  options: FigFileExtrasOptions
): Promise<ReadableStream<Uint8Array>> {
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
      appendAll(
        nodeChanges,
        sceneNodeToKiwi(
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
    appendAll(nodeChanges, slotContentRecords)
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

  const canvasFig = await compressFigCanvas({
    schemaDeflated,
    kiwiData,
    figKiwiVersion: graph.figKiwiVersion ?? undefined,
    compressionLevel: figCompressionLevel(sourceGraph),
    kind: graph.documentKind
  })
  return streamFigArchive({
    canvasFig,
    thumbnailPNG: extras.thumbnailPNG,
    metaJSON: extras.metaJSON,
    images: extras.images
  })
}

export type { FigFileExtrasOptions }
