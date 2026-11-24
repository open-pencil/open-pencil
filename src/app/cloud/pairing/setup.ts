import { cloudMCPResource } from '@open-pencil/cloud/contract'

/** The name an agent gives the connection, which its tools appear under. */
const SERVER_NAME = 'openpencil'

/**
 * What a person gives their agent to pair it with this tab: instructions it can follow on its own,
 * the Claude Code command, and the configuration other MCP clients take, all naming the endpoint
 * and the pairing token.
 */
export function agentPairingSetup(mcpURL: string, token: string) {
  const header = `Authorization: Bearer ${token}`
  return {
    instructions: [
      `Connect to OpenPencil: add an MCP server named "${SERVER_NAME}" over Streamable HTTP at ${mcpURL}, sending the header "${header}".`,
      'Its tools work on the design open in my OpenPencil tab, which I am watching. Start with get_page_tree.'
    ].join(' '),
    claudeCode: `claude mcp add --transport http ${SERVER_NAME} ${mcpURL} --header "${header}"`,
    config: JSON.stringify(
      {
        mcpServers: {
          [SERVER_NAME]: { url: mcpURL, headers: { Authorization: `Bearer ${token}` } }
        }
      },
      null,
      2
    )
  }
}

/** Adds the server to Claude Code with no token: the agent signs in, where the person may skip an account. */
export function agentSignInCommand(serverURL: string): string {
  return `claude mcp add --transport http ${SERVER_NAME} ${cloudMCPResource(serverURL)}`
}
