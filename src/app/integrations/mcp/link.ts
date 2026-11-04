import { promiseTimeout } from '@vueuse/core'

import { randomHex } from '@open-pencil/scene-graph/random'

import { watchChatAgent } from '@/app/automation/agents'
import { mcpRuntime } from '@/app/automation/mcp/runtime'

/** How long an agent may take to reach OpenPencil's tools once its session starts. */
export const AGENT_CONNECT_TIMEOUT_MS = 20_000

/** A chat's agent, linked to OpenPencil's MCP server by the chat id its session carries. */
export interface ChatAgentLink<Servers> {
  /** The id the agent's MCP session and tool calls carry, which ties them to this chat. */
  chat: string
  /** The server entries to start the agent's session with, as the agent's protocol takes them. */
  servers: Servers
  /**
   * Waits, once the session exists, for the server to say the agent opened its MCP session:
   * true when it did, false when it did not in time, null when the server cannot tell.
   */
  connected(timeoutMs?: number): Promise<boolean | null>
  stop(): void
}

/**
 * Names a chat's agent to OpenPencil's MCP server, so the server can report when this agent
 * connects and which chat its tool calls belong to. Link before the agent's session starts: the
 * agent connects while it starts.
 */
export async function linkChatAgent<Servers>(
  buildServers: (chat: string) => Promise<Servers>
): Promise<ChatAgentLink<Servers>> {
  const chat = randomHex(16)
  // Built before watching, so a server list that fails to build leaves no chat waiting.
  const servers = await buildServers(chat)
  // An older MCP server reports no sessions, so only a current one can confirm the agent.
  const watch = mcpRuntime.agentSessionEvents ? watchChatAgent(chat) : null
  return {
    chat,
    servers,
    async connected(timeoutMs = AGENT_CONNECT_TIMEOUT_MS) {
      if (!watch) return null
      try {
        return await Promise.race([
          watch.connected.then(() => true),
          promiseTimeout(timeoutMs).then(() => false)
        ])
      } finally {
        watch.stop()
      }
    },
    stop() {
      watch?.stop()
    }
  }
}
