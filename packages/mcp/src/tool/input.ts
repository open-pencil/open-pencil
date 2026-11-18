import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

import { readInsideRoot } from '#mcp/tool/output'

interface FileInput {
  /** The argument naming a file inside the MCP root. */
  path: string
  /** The Core argument the file's bytes fill, as Base64. */
  data: string
  description: string
}

/**
 * The tools that also take a file inside the MCP root in place of inline data. Clients can cut a
 * long argument short, so a photo sent as Base64 may arrive incomplete; a path keeps it out of
 * the call, and the server reads the file before the app runs the tool.
 */
const FILE_INPUTS: Partial<Record<string, FileInput>> = {
  set_image_fill: {
    path: 'image_path',
    data: 'image_data',
    description:
      'PNG, JPEG, or WEBP file to fill with, absolute or relative to the MCP root. ' +
      'Use it instead of image_data for photos.'
  }
}

/** A tool's input with its file argument beside the data it replaces, both then optional. */
export function withFileInput(toolName: string, entries: v.ObjectEntries): v.ObjectEntries {
  const input = FILE_INPUTS[toolName]
  const data = input && entries[input.data]
  if (!input || !data) return entries
  return {
    ...entries,
    [input.data]: v.optional(data),
    [input.path]: v.optional(v.pipe(v.string(), v.minLength(1), v.description(input.description)))
  }
}

/** The arguments with a file argument replaced by the file's bytes, read inside `root`. */
export async function readFileInput(
  toolName: string,
  args: Record<string, unknown>,
  root: string
): Promise<Record<string, unknown>> {
  const input = FILE_INPUTS[toolName]
  if (!input) return args
  const { [input.path]: path, ...rest } = args
  const hasData = args[input.data] !== undefined
  if (typeof path !== 'string') {
    if (hasData) return rest
    throw new Error(`Pass ${input.path} or ${input.data}`)
  }
  if (hasData) throw new Error(`Pass ${input.path} or ${input.data}, not both`)
  return { ...rest, [input.data]: fromUint8Array(await readInsideRoot(path, root)) }
}
