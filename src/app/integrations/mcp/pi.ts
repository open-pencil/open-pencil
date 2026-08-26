import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'

import { getAutomationAuthToken } from '@/app/automation/mcp/spawn'
import { describeDiagnosticError, recordMCPConnectionFailure } from '@/app/diagnostics'
import { appCredentialServices } from '@/app/settings/credentials/app'

import { enabledMCPConnections } from './store'
import type { MCPConnection } from './types'
export type PiMCPServer = {
  url: string
  headers?: Record<string, string>
  auth: false
}

async function externalPiMCPServer(connection: MCPConnection): Promise<PiMCPServer> {
  const headers: Record<string, string> = {}
  if (connection.authentication.type === 'bearer') {
    try {
      const token = await appCredentialServices.resolver.resolve(
        connection.authentication.credentialRef
      )
      if (!token) throw new Error('MCP connection needs a bearer token')
      headers.Authorization = `Bearer ${token}`
    } catch (error) {
      recordMCPConnectionFailure({ operation: 'connect', ...describeDiagnosticError(error) })
      throw error
    }
  }
  return {
    url: connection.transport.url,
    ...(Object.keys(headers).length ? { headers } : {}),
    auth: false
  }
}

export async function buildPiMCPServers(options?: {
  authorizationToken?: string | null
}): Promise<Record<string, PiMCPServer>> {
  const authorizationToken =
    options && 'authorizationToken' in options
      ? options.authorizationToken
      : await getAutomationAuthToken()
  const entries = await Promise.all(
    enabledMCPConnections.value.map(
      async (connection) => [connection.name, await externalPiMCPServer(connection)] as const
    )
  )
  return {
    ...Object.fromEntries(entries),
    'open-pencil': {
      url: `http://127.0.0.1:${AUTOMATION_HTTP_PORT}/mcp`,
      ...(authorizationToken ? { headers: { Authorization: `Bearer ${authorizationToken}` } } : {}),
      auth: false
    }
  }
}
