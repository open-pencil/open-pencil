import type { CallToolResult } from '@modelcontextprotocol/server'
import * as v from 'valibot'

/** What an MCP client reads back: the value as JSON text. */
export function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

/** A call that failed, in words the model can act on. */
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

const imageSchema = v.object({
  base64: v.string(),
  mimeType: v.pipe(v.string(), v.startsWith('image/'))
})

/**
 * A design tool's result as the client reads it: an exported image as an image, which a model
 * can look at, and anything else as JSON, as a local MCP server answers.
 */
export function designToolResult(result: unknown): CallToolResult {
  const image = v.safeParse(imageSchema, result)
  if (image.success) {
    return {
      content: [{ type: 'image', data: image.output.base64, mimeType: image.output.mimeType }]
    }
  }
  return jsonResult(result)
}

const errorBodySchema = v.object({
  error: v.object({ code: v.string(), message: v.optional(v.string()) })
})

/** The error code and message the document API answered with, if it named one. */
export function apiError(body: unknown): { code: string; message?: string } | null {
  const parsed = v.safeParse(errorBodySchema, body)
  return parsed.success ? parsed.output.error : null
}
