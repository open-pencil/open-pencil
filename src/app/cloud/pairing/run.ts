import { omit } from 'es-toolkit'

import { AGENT_PAIRING_COMMANDS } from '@open-pencil/cloud/contract'
import { errorMessage } from '@open-pencil/std/errors'
import { isRecord } from '@open-pencil/std/records'

import { isToolError } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { RunAgentTool } from '@/app/cloud/rooms/agent-tools'

/** What a paired agent may ask: design tools, and the commands on the editor's open documents. */
export const PAIRED_COMMANDS: ReadonlySet<string> = new Set(['tool', ...AGENT_PAIRING_COMMANDS])

let handlers: ReturnType<typeof createAutomationCommandHandlers> | null = null

/**
 * Runs a paired agent's request as the app runs the local MCP server's: a tool on the document it
 * names, the one it last worked on, or the active one, and the commands that list, make, and show
 * documents. It answers as the local server answers its client, a command's result with the
 * document it worked on.
 */
export const runPairedRequest: RunAgentTool = async (store, command, args, signal) => {
  handlers ??= createAutomationCommandHandlers(makeFigmaFromStore)
  // A new document stays unsaved: a paired agent names no path on this computer.
  const request = command === 'create_document' ? omit(args, ['path']) : args
  const response = await handlers.handleRequest(store, command, request, signal)
  if (!isRecord(response)) return response
  if (response.ok === false) throw new Error(errorMessage(response.error))
  const { result, target } = response
  if (command === 'tool') {
    // A tool may answer with its error rather than throw it.
    if (isToolError(result)) throw new Error(errorMessage(result.error))
    return result
  }
  return target ? { ...(isRecord(result) ? result : {}), target } : result
}
