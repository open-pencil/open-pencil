import type { McpServer } from '@agentclientprotocol/sdk'

import {
  MCP_AGENT_HEADER,
  MCP_CHAT_HEADER,
  OPEN_PENCIL_MCP_SERVER
} from '@open-pencil/core/constants'

import { getMCPServerURL } from '@/app/automation/mcp/spawn'
import { describeDiagnosticError, recordMCPConnectionFailure } from '@/app/diagnostics'
import { appCredentialServices } from '@/app/settings/credentials/app'

import { enabledMCPConnections } from './store'
import type { MCPConnection } from './types'

export type BuiltInMCPServerOptions = {
  authorizationToken: string | null
  /** The chat the agent works for, so the app sees when that agent reaches its tools. */
  chat?: string
}

export function builtInMCPServer(options: BuiltInMCPServerOptions): McpServer {
  return {
    type: 'http',
    name: OPEN_PENCIL_MCP_SERVER,
    url: getMCPServerURL(),
    // An ACP chat's tool calls show as an ACP agent rather than an outside MCP client.
    headers: [
      { name: MCP_AGENT_HEADER, value: 'acp' },
      ...(options.chat ? [{ name: MCP_CHAT_HEADER, value: options.chat }] : []),
      ...(options.authorizationToken
        ? [{ name: 'Authorization', value: `Bearer ${options.authorizationToken}` }]
        : [])
    ]
  }
}

async function externalMCPServer(connection: MCPConnection): Promise<McpServer> {
  const headers = []
  if (connection.authentication.type === 'bearer') {
    try {
      const token = await appCredentialServices.resolver.resolve(
        connection.authentication.credentialRef
      )
      if (!token) throw new Error('MCP connection needs a bearer token')
      headers.push({ name: 'Authorization', value: `Bearer ${token}` })
    } catch (error) {
      recordMCPConnectionFailure({ operation: 'connect', ...describeDiagnosticError(error) })
      throw error
    }
  }
  return {
    type: 'http',
    name: connection.name,
    url: connection.transport.url,
    headers
  }
}

export async function buildACPMCPServers(options: BuiltInMCPServerOptions): Promise<McpServer[]> {
  const external = await Promise.all(enabledMCPConnections.value.map(externalMCPServer))
  return [builtInMCPServer(options), ...external]
}
