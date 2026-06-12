#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { MCP_VERSION, registerTools } from './server'
import { createStdioRpcBridge } from './stdio-bridge'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    `openpencil-mcp\n\n` +
      `Start the OpenPencil MCP stdio bridge.\n\n` +
      `Connects to the MCP server via Unix domain socket on macOS/Linux ` +
      `(with TCP fallback) or via TCP on Windows.\n` +
      `The MCP server is started by the OpenPencil\n` +
      `desktop app; this bridge only forwards stdio JSON-RPC to it.\n\n` +
      `Options:\n` +
      `  --help, -h    Show this help message\n\n` +
      `Environment variables:\n` +
      `  OPENPENCIL_MCP_SOCKET        Override socket path\n` +
      `  OPENPENCIL_MCP_AUTH_TOKEN    Bearer token for RPC auth\n` +
      `  OPENPENCIL_MCP_ROOT          Allowed directory for file-scoped tools\n` +
      `  OPENPENCIL_MCP_EVAL          Set to 1 to enable the eval tool\n`
  )
  process.exit(0)
}

const enableEval = process.env.OPENPENCIL_MCP_EVAL === '1'
const mcpRoot = process.env.OPENPENCIL_MCP_ROOT?.trim() || process.cwd()
const socketPath = process.env.OPENPENCIL_MCP_SOCKET?.trim() || null
// Auth token: unset → auto-discover, empty string → disable auth, otherwise → use value
const authToken =
  process.env.OPENPENCIL_MCP_AUTH_TOKEN === ''
    ? null
    : process.env.OPENPENCIL_MCP_AUTH_TOKEN?.trim() || undefined

const bridge = createStdioRpcBridge({
  socketPath,
  authToken,
  onReady: () => {
    process.stderr.write('Connected to OpenPencil MCP server\n')
  },
  onReconnect: () => {
    process.stderr.write('Reconnected to OpenPencil MCP server\n')
  }
})

const mcpServer = new McpServer({ name: 'open-pencil', version: MCP_VERSION })
registerTools(mcpServer, { enableEval, mcpRoot, sendRpc: bridge.sendRpc })

const transport = new StdioServerTransport()
mcpServer.connect(transport).catch((err) => {
  process.stderr.write(`Fatal: MCP connect failed — ${err instanceof Error ? err.message : err}\n`)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`)
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  process.stderr.write(`Fatal: unhandled rejection — ${message}\n`)
  process.exit(1)
})
