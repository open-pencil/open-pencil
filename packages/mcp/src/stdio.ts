#!/usr/bin/env node
import process from 'node:process'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadMcpConfigFile, resolveMcpConfigPath } from './config.js'
import { MCP_VERSION, registerTools } from './server.js'
import { createStdioRpcBridge } from './stdio-bridge.js'

function readArgValue(name: string): string | null {
  const longFlag = `--${name}`
  const longPrefix = `${longFlag}=`
  const index = process.argv.findIndex((arg) => arg === longFlag || arg.startsWith(longPrefix))
  if (index === -1) return null
  const arg = process.argv[index]
  if (arg.startsWith(longPrefix)) return arg.slice(longPrefix.length)
  return process.argv[index + 1] ?? ''
}

function readBooleanFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    `openpencil-mcp\n\nStart the OpenPencil MCP stdio bridge.\n\nOptions:\n  --help, -h       Show this help message\n  --config <path>  Load settings from a JSON file (default: ./mcp.config.json)\n  --host <host>    WebSocket host (default: 127.0.0.1)\n  --ws-port <p>    WebSocket port (default: 7601)\n  --mcp-root <d>   Root directory exposed to MCP tools\n  --enable-eval    Allow eval tools when launching the server\n\nEnvironment variables mirror the same options: OPENPENCIL_MCP_CONFIG_PATH, HOST, WS_PORT, OPENPENCIL_MCP_ROOT, OPENPENCIL_MCP_EVAL.\n`
  )
  process.exit(0)
}

const cwd = process.cwd()
const configPath = resolveMcpConfigPath(
  cwd,
  normalizeNullable(readArgValue('config') ?? process.env.OPENPENCIL_MCP_CONFIG_PATH)
)
const config = loadMcpConfigFile(configPath)

const wsPort = Number.parseInt(readArgValue('ws-port') ?? process.env.WS_PORT ?? '7601', 10)
const wsHost = normalizeNullable(readArgValue('host') ?? process.env.HOST) ?? '127.0.0.1'
const enableEval =
  readBooleanFlag('enable-eval') || process.env.OPENPENCIL_MCP_EVAL === '1' || config?.enableEval === true
const mcpRoot =
  normalizeNullable(readArgValue('mcp-root') ?? process.env.OPENPENCIL_MCP_ROOT) ??
  (typeof config?.mcpRoot === 'string' ? config.mcpRoot.trim() || null : config?.mcpRoot ?? null) ??
  process.cwd()

const wsUrl = `ws://${wsHost}:${wsPort}`
const bridge = createStdioRpcBridge({
  wsUrl,
  onOpen: () => {
    process.stderr.write(`Connected to OpenPencil app at ${wsUrl}\n`)
  },
  onMalformedMessage: () => {
    process.stderr.write('Malformed WS message\n')
  }
})

bridge.connect()

const mcpServer = new McpServer({ name: 'open-pencil', version: MCP_VERSION })
registerTools(mcpServer, { enableEval, mcpRoot, sendRpc: bridge.sendRpc })

const transport = new StdioServerTransport()
void mcpServer.connect(transport)
