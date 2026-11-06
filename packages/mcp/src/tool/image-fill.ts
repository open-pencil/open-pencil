import { Buffer } from 'node:buffer'

import { fromUint8Array } from 'js-base64'

import { readInsideRoot } from '#mcp/tool/output'

const DATA_URL_PREFIX = /^data:image\/[a-z0-9.+-]+;base64,/i

/** Strip a `data:image/...;base64,` prefix agents often leave on `image_data`. */
export function stripImageDataUrl(imageData: string): string {
  const trimmed = imageData.trim()
  const match = DATA_URL_PREFIX.exec(trimmed)
  return match ? trimmed.slice(match[0].length) : trimmed
}

/**
 * Resolve `set_image_fill` args for the app RPC.
 *
 * Large base64 blobs often get truncated in MCP client tool-arg transport. Prefer `image_path`
 * under `OPENPENCIL_MCP_ROOT`; the server reads the file and injects `image_data` before the
 * WebSocket hop to the desktop app (which can carry larger payloads).
 */
export async function resolveImageFillArgs(
  args: Record<string, unknown>,
  mcpRoot: string | null
): Promise<Record<string, unknown>> {
  const imagePath = typeof args.image_path === 'string' ? args.image_path.trim() : ''
  const rawData = typeof args.image_data === 'string' ? args.image_data : undefined
  const imageData = rawData !== undefined ? stripImageDataUrl(rawData) : undefined

  if (imagePath) {
    if (!mcpRoot) {
      throw new Error(
        'image_path requires OPENPENCIL_MCP_ROOT (or the desktop app MCP root). ' +
          'Pass image_data instead, or configure the MCP root and retry.'
      )
    }
    const bytes = await readInsideRoot(imagePath, mcpRoot)
    const { image_path: _path, ...rest } = args
    return {
      ...rest,
      image_data: fromUint8Array(bytes)
    }
  }

  if (imageData !== undefined) {
    if (imageData.length === 0) {
      throw new Error('image_data is empty')
    }
    // Truncation in transit often leaves length % 4 === 1 and no padding.
    // Ignore whitespace so line-wrapped base64 is not false-positive rejected.
    if (imageData.replace(/\s+/g, '').length % 4 === 1) {
      throw new Error(
        'image_data looks truncated (length mod 4 = 1). ' +
          'Pass image_path under the MCP root instead of inlining base64.'
      )
    }
    return { ...args, image_data: imageData }
  }

  throw new Error(
    'set_image_fill requires image_path (preferred, under MCP root) or image_data (base64)'
  )
}

/** Approx UTF-8 size of the resolved image_data string, for tests and diagnostics. */
export function imageDataByteLength(imageData: string): number {
  return Buffer.byteLength(imageData, 'utf8')
}
