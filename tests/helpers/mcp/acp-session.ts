import {
  AgentSideConnection,
  ClientSideConnection,
  PROTOCOL_VERSION,
  type Agent,
  type Client,
  type McpServer,
  type NewSessionRequest
} from '@agentclientprotocol/sdk'

import { buildACPMCPServers } from '@/app/integrations/mcp'

function pairedStreams() {
  const clientToAgent = new TransformStream()
  const agentToClient = new TransformStream()
  return {
    client: { writable: clientToAgent.writable, readable: agentToClient.readable },
    agent: { writable: agentToClient.writable, readable: clientToAgent.readable }
  }
}

export async function captureACPSessionMCPServers(): Promise<McpServer[]> {
  const streams = pairedStreams()
  let received: NewSessionRequest | null = null
  const client: Client = {
    requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
    sessionUpdate: async () => undefined
  }
  const agent: Agent = {
    initialize: async () => ({
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false }
    }),
    newSession: async (params) => {
      received = params
      return { sessionId: 'smoke-session' }
    },
    authenticate: async () => ({}),
    prompt: async () => ({ stopReason: 'end_turn' }),
    cancel: async () => undefined
  }

  const agentConnection = new AgentSideConnection(() => agent, streams.agent)
  const connection = new ClientSideConnection(() => client, streams.client)
  await connection.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
  await connection.newSession({
    cwd: '/tmp',
    mcpServers: await buildACPMCPServers({ authorizationToken: 'built-in-token' })
  })
  if (!received) throw new Error('ACP agent did not receive session configuration')
  void agentConnection
  return received.mcpServers
}
