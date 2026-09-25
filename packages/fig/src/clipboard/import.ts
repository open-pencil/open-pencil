import { inflateSync } from 'fflate'
import { decode as decodeText, toUint8Array, isValid } from 'js-base64'

import type { NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '@open-pencil/kiwi/schema-runtime'

import { parseFigKiwiChunks, decompressFigKiwiDataAsync } from '../node-change'

function decodeBase64(value: string): Uint8Array {
  if (!isValid(value)) throw new TypeError('Invalid Base64 string')
  return toUint8Array(value)
}
function decodeBase64Text(value: string): string {
  if (!isValid(value)) throw new TypeError('Invalid Base64 string')
  return decodeText(value)
}

interface FigmaClipboardMeta {
  fileKey: string
  pasteID: number
  dataType: string
}

export async function parseFigmaClipboard(
  html: string
): Promise<{ nodes: KiwiNodeChange[]; meta: FigmaClipboardMeta; blobs: Uint8Array[] } | null> {
  const metaMatch = html.match(/\(figmeta\)(.*?)\(\/figmeta\)/)
  const bufMatch = html.match(/\(figma\)(.*?)\(\/figma\)/s)
  if (!metaMatch || !bufMatch) return null

  const meta: FigmaClipboardMeta = JSON.parse(decodeBase64Text(metaMatch[1]))
  const binary = decodeBase64(bufMatch[1])

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
    }

    const blobs: Uint8Array[] = (msg.blobs ?? []).map((b) =>
      b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes))
    )

    return { nodes: msg.nodeChanges ?? [], meta, blobs }
  } catch {
    return null
  }
}

const NON_VISUAL_TYPES = new Set([
  'DOCUMENT',
  'CANVAS',
  'VARIABLE_SET',
  'VARIABLE',
  'VARIABLE_COLLECTION',
  'STYLE',
  'STYLE_SET',
  'INTERNAL_ONLY_NODE',
  'WIDGET',
  'STAMP',
  'STICKY',
  'SHAPE_WITH_TEXT',
  'CONNECTOR',
  'CODE_BLOCK',
  'TABLE_NODE',
  'TABLE_CELL',
  'SECTION_OVERLAY',
  'SLIDE'
])

function isChildOfVisualNode(nc: KiwiNodeChange, parentTypes: Map<string, string>): boolean {
  const parentId = nc.parentIndex?.guid
    ? `${nc.parentIndex.guid.sessionID}:${nc.parentIndex.guid.localID}`
    : null
  return (
    !!parentId &&
    parentTypes.has(parentId) &&
    !NON_VISUAL_TYPES.has(parentTypes.get(parentId) ?? '')
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
    if (!nc.type || NON_VISUAL_TYPES.has(nc.type)) continue
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
