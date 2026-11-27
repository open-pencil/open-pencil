import { omit } from 'es-toolkit'

import { AGENT_PAIRING_COMMANDS } from '@open-pencil/cloud/contract'
import { errorMessage } from '@open-pencil/std/errors'
import { isRecord } from '@open-pencil/std/records'

import { isToolError } from '@/app/ai/tools/runner'
import type { RunAgentTool } from '@/app/cloud/rooms/agent-tools'
import type { EditorStore } from '@/app/editor/session'

/** What a paired agent may ask: design tools, and the commands on the editor's open documents. */
export const PAIRED_COMMANDS: ReadonlySet<string> = new Set(['tool', ...AGENT_PAIRING_COMMANDS])

/**
 * How the app runs a local MCP server's request, `createAutomationCommandHandlers`'s
 * `handleRequest`, which the editor passes in: the command set reaches back to Cloud.
 */
export type HandleAutomationRequest = (
  store: EditorStore,
  command: string,
  args: unknown,
  signal?: AbortSignal
) => Promise<unknown>

/**
 * Runs a paired agent's requests as the app runs the local MCP server's: a tool on the document it
 * names, the one it last worked on, or the active one, and the commands that list, make, and show
 * documents. It answers as the local server answers its client, a command's result with the
 * document it worked on.
 */
export const pairedRequests =
  (handleRequest: HandleAutomationRequest): RunAgentTool =>
  async (store, command, args, signal) => {
    // A new document stays unsaved: a paired agent names no path on this computer.
    const request = command === 'create_document' ? omit(args, ['path']) : args
    return answerAsLocalServer(command, await handleRequest(store, command, request, signal))
  }

/** A command's response as the local MCP server gives its client: a tool's result, or what a document command did, and where. */
function answerAsLocalServer(command: string, response: unknown): unknown {
  if (!isRecord(response)) return response
  if (response.ok === false) throw new Error(errorMessage(response.error))
  const { result, target } = response
  if (command === 'tool') {
    // A tool may answer with its error rather than throw it.
    if (isToolError(result)) throw new Error(errorMessage(result.error))
    return result
  }
  if (!target) return result
  return isRecord(result) ? { ...result, target } : { target }
}
