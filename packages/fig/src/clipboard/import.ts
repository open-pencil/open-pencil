import { inflateSync } from 'fflate'
import { decode as decodeText, toUint8Array, isValid } from 'js-base64'
import * as v from 'valibot'

import type { NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import { decompressFigKiwiDataAsync, parseFigKiwiChunks } from '@open-pencil/kiwi/fig/container'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'

import { isFigClipboardVisualType } from '../node-classification'

const figmaClipboardMetaSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ fileKey: v.string(), pasteID: v.number(), dataType: v.string() })
)

type FigmaClipboardMeta = v.InferOutput<typeof figmaClipboardMetaSchema>

export interface ParsedFigmaClipboard {
  nodes: KiwiNodeChange[]
  meta: FigmaClipboardMeta
  blobs: Uint8Array[]
  /** `STYLE_PROPERTIES` for Copy properties, which Paste skips and Paste properties reads. */
  assetType: string
}

/**
 * The Base64 metadata and buffer Figma's clipboard HTML carries between its markers, unchecked,
 * or null for HTML that carries none.
 */
export function figmaClipboardPayload(html: string): { meta: string; buffer: string } | null {
  const meta = /\(figmeta\)(.*?)\(\/figmeta\)/.exec(html)?.[1]
  const buffer = /\(figma\)(.*?)\(\/figma\)/s.exec(html)?.[1]
  return meta && buffer ? { meta, buffer } : null
}

export async function parseFigmaClipboard(html: string): Promise<ParsedFigmaClipboard | null> {
  const payload = figmaClipboardPayload(html)
  if (!payload) return null

  // Clipboard HTML comes from other applications, so its Base64 is checked first.
  if (!isValid(payload.meta) || !isValid(payload.buffer))
    throw new TypeError('Invalid Base64 string')
  const parsedMeta = v.safeParse(figmaClipboardMetaSchema, decodeText(payload.meta))
  if (!parsedMeta.success) return null
  const meta = parsedMeta.output
  const binary = toUint8Array(payload.buffer)

  try {
    const chunks = parseFigKiwiChunks(binary)
    if (!chunks) return null

    const schemaBytes = inflateSync(chunks[0])
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema)
    if (!compiled.decodeMessage) return null
    const dataRaw = await decompressFigKiwiDataAsync(chunks[1])
    const msg = compiled.decodeMessage(dataRaw) as {
      nodeChanges?: KiwiNodeChange[]
      blobs?: Array<{ bytes: Uint8Array | Record<string, number> }>
      pasteAssetType?: string
    }

    const blobs: Uint8Array[] = (msg.blobs ?? []).map((b) =>
      b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes))
    )

    return { nodes: msg.nodeChanges ?? [], meta, blobs, assetType: msg.pasteAssetType ?? 'UNKNOWN' }
  } catch {
    return null
  }
}

function isChildOfVisualNode(nc: KiwiNodeChange, parentTypes: Map<string, string>): boolean {
  const parentId = nc.parentIndex?.guid
    ? `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`
    : null
  return (
    !!parentId && parentTypes.has(parentId) && isFigClipboardVisualType(parentTypes.get(parentId))
  )
}

export function figmaNodesBounds(
  nodeChanges: KiwiNodeChange[]
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const parentTypes = new Map<string, string>()
  for (const nc of nodeChanges) {
    if (!nc.guid) continue
    const id = `${nc.guid.sessionID}:${nc.guid.localID}`
    parentTypes.set(id, nc.type ?? '')
  }

  for (const nc of nodeChanges) {
    if (!isFigClipboardVisualType(nc.type)) continue
    if (isChildOfVisualNode(nc, parentTypes)) continue

    const x = nc.transform?.m02 ?? 0
    const y = nc.transform?.m12 ?? 0
    const w = nc.size?.x ?? 0
    const h = nc.size?.y ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  if (minX === Infinity) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
