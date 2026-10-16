import { Buffer } from 'node:buffer'

import { decode } from 'js-base64'

export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | {
      type: 'resource'
      resource: { uri: string; mimeType: string } & ({ blob: string } | { text: string })
    }

export type MCPResult = { content: MCPContent[]; isError?: boolean }

export const MAX_RESULT_BYTES = 900_000

export function resultTooLargeMessage(kind: string, bytes: number, hint: string): string {
  return `${kind} is too large (${Math.round(bytes / 1024)}KB, limit ${Math.round(
    MAX_RESULT_BYTES / 1024
  )}KB). ${hint}`
}

export function ok(data: unknown, toolName?: string): MCPResult {
  const text = JSON.stringify(data, null, 2)
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes > MAX_RESULT_BYTES) {
    return fail(
      new Error(
        resultTooLargeMessage(
          toolName ? `Result from "${toolName}"` : 'Result',
          bytes,
          'Narrow the request with depth/root_id/node_types, get_node, or find_nodes.'
        )
      )
    )
  }
  return { content: [{ type: 'text', text }] }
}

export function fail(e: unknown): MCPResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

/** The only image types model APIs accept in a tool result: PNG, JPEG, GIF, and WEBP. */
const RASTER_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
])

export function isRasterImageMime(mimeType: string): boolean {
  return RASTER_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())
}

/**
 * A binary export as MCP content. A raster image goes back as an `image` part; anything else, such
 * as a PDF or an SVG, goes back as an embedded resource, because a client that forwards a non-raster
 * `image` part to a model API gets the whole conversation rejected.
 */
export function binaryContent(base64: string, mimeType: string, name: string): MCPContent {
  if (isRasterImageMime(mimeType)) return { type: 'image', data: base64, mimeType }
  const uri = `openpencil://export/${name}`
  if (mimeType.toLowerCase() === 'image/svg+xml') {
    return {
      type: 'resource',
      resource: { uri, mimeType, text: decode(base64) }
    }
  }
  return { type: 'resource', resource: { uri, mimeType, blob: base64 } }
}
