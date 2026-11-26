import type { McpServer, SessionUpdate } from '@agentclientprotocol/sdk/unstable'

import { OPEN_PENCIL_MCP_SERVER, type ACPAgentDef } from '@open-pencil/core/constants'

import { buildACPMCPServers } from '@/app/integrations/mcp'
import { linkChatAgent } from '@/app/integrations/mcp/link'

import { textFromContent } from './events'

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
export async function linkOwnTools(
  authorizationToken: string | null,
  options: { defersTools?: boolean } = {}
): Promise<OwnToolsLink> {
  const link = await linkChatAgent((chat) =>
    buildACPMCPServers({ authorizationToken, chat, defersTools: options.defersTools })
  )
  const failures: string[] = []
  return {
    chat: link.chat,
    mcpServers: link.servers,
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

/** The agent never opened its session with OpenPencil's MCP server, so it has no design tools. */
export function toolsUnreachableError(agentDef: ACPAgentDef, reason: string | null): Error {
  return new Error(
    `${agentDef.name} couldn't reach OpenPencil's tools, so your message wasn't sent.` +
      (reason ? ` ${agentDef.name} reported: ${reason}` : '')
  )
}

/** Closes a tools link that opens after the startup gave up, so it does not stay open. */
export function stopWhenLinked(linking: Promise<OwnToolsLink>): void {
  linking.then((late) => late.stop()).catch(() => undefined)
}
