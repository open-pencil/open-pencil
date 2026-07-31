import type { CanvasKit } from 'canvaskit-wasm'
import { deflateSync, inflateSync } from 'fflate'

import {
  defaultDeckMetaJson,
  structurePagesToDeck,
  writeDeckArchive
} from '@open-pencil/deck'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec, getCompiledSchema, getSchemaBytes } from '@open-pencil/kiwi/fig/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { decodeBase64 } from '#core/bytes'
import type { SkiaRenderer } from '#core/canvas'
import { exportFigFile } from '#core/io/formats/fig/export'

const THUMBNAIL_1X1 = decodeBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
)

/**
 * Serialize a SceneGraph as a Figma Slides `.deck` archive.
 * Uses the design `.fig` export path, then wraps pages in slide scaffolding
 * and rewrites the container prelude to `fig-deck`.
 */
export async function exportDeckFile(
  graph: SceneGraph,
  ck?: CanvasKit,
  renderer?: SkiaRenderer,
  pageId?: string,
  renderHeadlessThumbnail = false
): Promise<Uint8Array> {
  const figBytes = await exportFigFile(graph, ck, renderer, pageId, renderHeadlessThumbnail)
  const parsed = parseFigBuffer(
    figBytes.buffer.slice(figBytes.byteOffset, figBytes.byteOffset + figBytes.byteLength)
  )

  const deckNodeChanges = structurePagesToDeck(parsed.nodeChanges)

  await initCodec()
  let compiled: ReturnType<typeof getCompiledSchema>
  let schemaDeflated: Uint8Array
  if (graph.figSchemaDeflated) {
    const schemaBytes = inflateSync(graph.figSchemaDeflated)
    const figSchema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    compiled = compileSchema(figSchema) as ReturnType<typeof getCompiledSchema>
    schemaDeflated = graph.figSchemaDeflated
  } else if (parsed.figSchemaDeflated) {
    const schemaBytes = inflateSync(parsed.figSchemaDeflated)
    const figSchema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    compiled = compileSchema(figSchema) as ReturnType<typeof getCompiledSchema>
    schemaDeflated = parsed.figSchemaDeflated
  } else {
    compiled = getCompiledSchema()
    schemaDeflated = deflateSync(getSchemaBytes())
  }

  const msg: Record<string, unknown> = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges: deckNodeChanges
  }
  if (parsed.blobs.length > 0) {
    msg.blobs = parsed.blobs.map((bytes) => ({ bytes }))
  }

  const kiwiData = compiled.encodeMessage(msg)

  // Pull thumbnail from the intermediate .fig zip when present
  let thumbnailPng: Uint8Array | undefined
  try {
    const { unzipSync } = await import('fflate')
    const archive = unzipSync(figBytes)
    thumbnailPng = archive['thumbnail.png']
  } catch {
    thumbnailPng = undefined
  }
  if (!thumbnailPng?.byteLength) {
    thumbnailPng = THUMBNAIL_1X1
  }

  const images = parsed.images.map(([hash, data]) => ({ name: hash, data }))

  return writeDeckArchive({
    schemaDeflated,
    kiwiData,
    thumbnailPng,
    metaJson: defaultDeckMetaJson('Untitled.deck'),
    images,
    figKiwiVersion: graph.figKiwiVersion ?? parsed.figKiwiVersion
  })
}
