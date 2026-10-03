import { Buffer } from 'node:buffer'

import type { RPCJSONObject } from '#mcp/json'
import { MAX_RESULT_BYTES, fail, resultTooLargeMessage, type MCPResult } from '#mcp/result'

export function imageToolResult(toolName: string, result: RPCJSONObject): MCPResult | null {
  if (!('base64' in result) || !('mimeType' in result)) return null
  const base64 = String(result.base64)
  const bytes = Buffer.byteLength(base64, 'utf8')
  if (bytes > MAX_RESULT_BYTES) {
    return fail(
      new Error(
        resultTooLargeMessage(
          `Image from "${toolName}"`,
          bytes,
          'Export a smaller region or lower the scale/resolution.'
        )
      )
    )
  }
  const image = { type: 'image' as const, data: base64, mimeType: result.mimeType as string }
  if (toolName !== 'see_user_selection') return { content: [image] }
  const { base64: _base64, ...metadata } = result
  const text = JSON.stringify(metadata, null, 2)
  return {
    content: [{ type: 'text' as const, text }, image],
    structuredContent: metadata
  }
}
