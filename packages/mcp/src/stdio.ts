#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createStdioRpcBridge } from './stdio-bridge.js'
import { MCP_VERSION, registerTools } from './server.js'

const wsPort = parseInt(process.env.WS_PORT ?? '7601', 10)
const wsHost = process.env.HOST ?? '127.0.0.1'
const enableEval = process.env.OPENPENCIL_MCP_EVAL === '1'
const mcpRoot = process.env.OPENPENCIL_MCP_ROOT?.trim() || process.cwd()

const wsUrl = `ws://${wsHost}:${wsPort}`
const bridge = createStdioRpcBridge({
  wsUrl,
  onOpen: () => {
    process.stderr.write(`Connected to OpenPencil app at ${wsUrl}\n`)
  },
  onMalformedMessage: () => {
    process.stderr.write('Malformed WS message\n')
  },
})

bridge.connect()

const mcpServer = new McpServer({ name: 'open-pencil', version: MCP_VERSION })
registerTools(mcpServer, { enableEval, mcpRoot, sendRpc: bridge.sendRpc })

const transport = new StdioServerTransport()
void mcpServer.connect(transport)
