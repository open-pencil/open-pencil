import { mcpClientToken } from '@open-pencil/mcp/tools'

import { getAutomationAuthToken } from './spawn'

/**
 * The token an agent connects to the MCP server with. The server's own token also opens raw
 * commands, file access, and the app's socket, past the tool settings, so an agent gets the
 * client token derived from it, which opens the tools alone.
 */
export async function getMCPClientToken(): Promise<string | null> {
  const serverToken = await getAutomationAuthToken()
  return serverToken ? mcpClientToken(serverToken) : null
}
