import {
  agent,
  client,
  methods,
  PROTOCOL_VERSION,
  type McpServer,
  type NewSessionRequest
} from '@agentclientprotocol/sdk/unstable'

import { buildACPMCPServers } from '@/app/integrations/mcp'

export async function captureACPSessionMCPServers(): Promise<McpServer[]> {
  const captured: { request?: NewSessionRequest } = {}
  const fakeAgent = agent()
    .onRequest(methods.agent.initialize, () => ({
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false }
    }))
    .onRequest(methods.agent.session.new, ({ params }) => {
      captured.request = params
      return { sessionId: 'smoke-session' }
    })
  await client().connectWith(fakeAgent, async (connection) => {
    await connection.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {}
    })
    await connection.request(methods.agent.session.new, {
      cwd: '/tmp',
      mcpServers: await buildACPMCPServers({ authorizationToken: 'built-in-token' })
    })
  })
  const received = captured.request
  if (!received) throw new Error('ACP agent did not receive session configuration')
  return received.mcpServers
}
