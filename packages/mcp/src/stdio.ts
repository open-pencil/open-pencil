#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { MCP_VERSION, registerTools } from './server.js'
import { createStdioRpcBridge } from './stdio-bridge.js'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    `inkly-mcp\n\nStart the Inkly MCP stdio bridge.\n\nOptions:\n  --help, -h    Show this help message\n`
  )
  process.exit(0)
}

const wsPort = Number.parseInt(process.env.WS_PORT ?? '7601', 10)
const wsHost = process.env.HOST ?? '127.0.0.1'
const enableEval = process.env.INKLY_MCP_EVAL === '1'
const mcpRoot = process.env.INKLY_MCP_ROOT?.trim() || process.cwd()

const wsUrl = `ws://${wsHost}:${wsPort}`
const bridge = createStdioRpcBridge({
  wsUrl,
  onOpen: () => {
    process.stderr.write(`Connected to Inkly app at ${wsUrl}\n`)
  },
  onMalformedMessage: () => {
    process.stderr.write('Malformed WS message\n')
  }
})

bridge.connect()

const mcpServer = new McpServer({ name: 'inkly', version: MCP_VERSION })
registerTools(mcpServer, { enableEval, mcpRoot, sendRpc: bridge.sendRpc })

const transport = new StdioServerTransport()
void mcpServer.connect(transport)
