import type {
  McpServer,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionUpdate
} from '@agentclientprotocol/sdk'

import { OPEN_PENCIL_MCP_SERVER } from '@open-pencil/core/constants'

import { buildACPMCPServers } from '@/app/integrations/mcp'
import { linkChatAgent } from '@/app/integrations/mcp/link'

import { isOwnToolCall, textFromContent } from './events'

/**
 * Lets the agent use OpenPencil's own tools without asking each time: their edits are undoable
 * and stay in the document the chat works on. Claude's adapter passes these options to the
 * Claude Agent SDK, where a bare server name allows every tool on it; other agents ignore it.
 */
export const OWN_TOOLS_ALLOWED = {
  claudeCode: { options: { allowedTools: [`mcp__${OPEN_PENCIL_MCP_SERVER}`] } }
}

/**
 * Answers the permission requests of agents that ask before every MCP call, as Cursor does, for
 * OpenPencil's own tools, on the same grounds as `OWN_TOOLS_ALLOWED`. A request carries only the
 * call's id, so the updates that name the call's server are noted first. Each call is allowed
 * once, which leaves the agent's saved permissions alone.
 */
export function createOwnToolApproval() {
  const ownCalls = new Set<string>()
  return {
    noteUpdate(update: SessionUpdate) {
      if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update')
        return
      if (isOwnToolCall(update)) ownCalls.add(update.toolCallId)
    },
    /** The answer for a call to OpenPencil's tools; null when the person decides. */
    answer(request: RequestPermissionRequest): RequestPermissionResponse | null {
      if (!ownCalls.has(request.toolCall.toolCallId)) return null
      const allow = request.options.find((option) => option.kind === 'allow_once')
      return allow ? { outcome: { outcome: 'selected', optionId: allow.optionId } } : null
    }
  }
}

/** Whether an agent's session reached OpenPencil's tools; null when the server cannot tell. */
export type OwnToolsOutcome =
  | { connected: true }
  | { connected: false; reason: string | null }
  | { connected: null }

/** What an ACP agent's new session needs to reach OpenPencil's tools, and how to tell it did. */
export interface OwnToolsLink {
  /** The id the agent's MCP session and tool calls carry, which ties them to this chat. */
  chat: string
  mcpServers: McpServer[]
  meta: typeof OWN_TOOLS_ALLOWED
  /** Reads an update sent before any prompt, where a failed tool call is a server that failed. */
  noteUpdate(update: SessionUpdate): void
  /** Waits, once the session exists, for the agent to open its MCP session. */
  outcome(): Promise<OwnToolsOutcome>
  stop(): void
}

/**
 * Links a new ACP session to OpenPencil's MCP server. Codex reports a server it could not start
 * as a failed tool call before any prompt, which gives the reason when the agent never connects.
 */
export async function linkOwnTools(authorizationToken: string | null): Promise<OwnToolsLink> {
  const link = await linkChatAgent((chat) => buildACPMCPServers({ authorizationToken, chat }))
  const failures: string[] = []
  return {
    chat: link.chat,
    mcpServers: link.servers,
    meta: OWN_TOOLS_ALLOWED,
    noteUpdate(update) {
      if (update.sessionUpdate !== 'tool_call' || update.status !== 'failed') return
      const text = textFromContent(update.content ?? undefined)
      if (text?.includes(OPEN_PENCIL_MCP_SERVER)) failures.push(text)
    },
    async outcome() {
      const connected = await link.connected()
      if (connected === null) return { connected: null }
      return connected ? { connected: true } : { connected: false, reason: failures.at(-1) ?? null }
    },
    stop: () => link.stop()
  }
}
