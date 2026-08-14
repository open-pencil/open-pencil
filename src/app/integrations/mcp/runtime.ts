import type { McpServer } from '@agentclientprotocol/sdk'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'

import { appCredentialServices } from '@/app/settings/credentials/app'

import { enabledMCPConnections } from './store'
import type { MCPConnection } from './types'

export type BuiltInMCPServerOptions = {
  authorizationToken: string | null
}

export function builtInMCPServer(options: BuiltInMCPServerOptions): McpServer {
  return {
    type: 'http',
    name: 'open-pencil',
    url: `http://127.0.0.1:${AUTOMATION_HTTP_PORT}/mcp`,
    headers: options.authorizationToken
      ? [{ name: 'Authorization', value: `Bearer ${options.authorizationToken}` }]
      : []
  }
}

async function externalMCPServer(connection: MCPConnection): Promise<McpServer> {
  const headers = []
  if (connection.authentication.type === 'bearer') {
    const token = await appCredentialServices.resolver.resolve(
      connection.authentication.credentialRef
    )
    if (!token) throw new Error(`MCP connection "${connection.name}" needs a bearer token`)
    headers.push({ name: 'Authorization', value: `Bearer ${token}` })
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
