import { deflateSync } from 'fflate'
import { encode, fromUint8Array } from 'js-base64'

import { getCompiledSchema, getSchemaBytes } from '@open-pencil/kiwi/fig/codec'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { buildFigKiwi } from '../node-change'

/** Encode prepared node changes; runtime shaping and font loading belong to the caller. */
export function encodeFigmaClipboard(
  nodeChanges: NodeChange[],
  blobs: Uint8Array[],
  pasteID: number
): string {
  const message = {
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    pasteID,
    pasteFileKey: 'openpencil',
    nodeChanges,
    blobs: blobs.map((bytes) => ({ bytes }))
  }
  const binary = buildFigKiwi(
    deflateSync(getSchemaBytes()),
    getCompiledSchema().encodeMessage(message)
  )
  const meta = encode(JSON.stringify({ fileKey: 'openpencil', pasteID, dataType: 'scene' }))
  return `<meta charset='utf-8'><span data-metadata="<!--(figmeta)${meta}(/figmeta)-->"></span><span data-buffer="<!--(figma)${fromUint8Array(binary)}(/figma)-->"></span>`
}
