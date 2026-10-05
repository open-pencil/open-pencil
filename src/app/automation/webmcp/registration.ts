// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toJsonSchema as toJSONSchema } from '@valibot/to-json-schema'
import type { WebMCP } from 'webmcp-types'

import { parseToolArgs, type ToolDef } from '@open-pencil/core/tools'

import { getWebMCPTools, type WebMCPMode } from './policy'

const MAX_RESULT_BYTES = 256 * 1024

export interface WebMCPExecutionTarget {
  execute: (def: ToolDef, args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>
}

export interface WebMCPRegistration {
  ready: Promise<void>
  dispose: () => void
}

/** Capture the document before invoking any asynchronous work. */
export function registerWebMCPTools(
  context: Pick<WebMCP.ModelContext, 'registerTool'> | undefined,
  getTarget: () => WebMCPExecutionTarget,
  mode: WebMCPMode
): WebMCPRegistration {
  const lifetime = new AbortController()
  const dispose = () => lifetime.abort()
  const ready = (async () => {
    if (!context) return
    try {
      for (const def of getWebMCPTools(mode)) {
        lifetime.signal.throwIfAborted()
        const schema = def.input
        await context.registerTool(
          {
            name: def.name,
            description: `${def.description} Targets the active OpenPencil document.`,
            inputSchema: toJSONSchema(schema, { typeMode: 'input' }),
            annotations: { readOnlyHint: !def.mutates, untrustedContentHint: true },
            execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions) => {
              // Early document.modelContext implementations omit execution options.
              const signal = options?.signal
                ? AbortSignal.any([lifetime.signal, options.signal])
                : lifetime.signal
              lifetime.signal.throwIfAborted()
              signal.throwIfAborted()
              const args = parseToolArgs(def.name, schema, input)
              const target = getTarget()
              const result = await target.execute(def, args, signal)
              // A synchronous mutation has committed; a later abort cannot roll it back.
              if (!def.mutates) signal.throwIfAborted()
              const text = JSON.stringify(result ?? null)
              if (new TextEncoder().encode(text).byteLength > MAX_RESULT_BYTES) {
                if (def.mutates) {
                  return JSON.stringify({
                    ok: true,
                    resultOmitted: true,
                    message:
                      'Edit committed. Result exceeds the size limit; inspect a smaller selection.'
                  })
                }
                throw new Error('Result too large. Narrow the query or reduce its depth/limit.')
              }
              return text
            }
          },
          { signal: lifetime.signal }
        )
      }
    } catch (error) {
      const disposed = lifetime.signal.aborted
      dispose()
      if (!disposed) throw error
    }
  })()
  return { ready, dispose }
}
