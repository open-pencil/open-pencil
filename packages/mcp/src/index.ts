#!/usr/bin/env node
import { serve } from '@hono/node-server'
import process from 'node:process'

import { loadMcpConfigFile, resolveMcpConfigPath } from './config.js'
import { startServer } from './server.js'

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
    `openpencil-mcp-http\n\nStart the OpenPencil MCP HTTP and WebSocket server.\n\nOptions:\n  --help, -h          Show this help message\n  --config <path>     Load settings from a JSON file (default: ./mcp.config.json)\n  --host <host>       Bind host (default: 127.0.0.1)\n  --port <port>       HTTP port (default: 7600)\n  --ws-port <port>    WebSocket port (default: 7601)\n  --auth-token <tok>  Require this bearer token for MCP requests\n  --cors-origin <o>   Enable CORS for the given origin\n  --mcp-root <dir>    Root directory exposed to MCP tools\n  --enable-eval       Allow eval tools when launching the server\n\nEnvironment variables mirror the same options: OPENPENCIL_MCP_CONFIG_PATH, HOST, PORT, WS_PORT, OPENPENCIL_MCP_AUTH_TOKEN, OPENPENCIL_MCP_CORS_ORIGIN, OPENPENCIL_MCP_ROOT, OPENPENCIL_MCP_EVAL.\n`
  )
  process.exit(0)
}

const cwd = process.cwd()
const configPath = resolveMcpConfigPath(
  cwd,
  normalizeNullable(readArgValue('config') ?? process.env.OPENPENCIL_MCP_CONFIG_PATH)
)
const config = loadMcpConfigFile(configPath)

const port = Number.parseInt(readArgValue('port') ?? process.env.PORT ?? `${config?.httpPort ?? 7600}`, 10)
const wsPort = Number.parseInt(readArgValue('ws-port') ?? process.env.WS_PORT ?? '7601', 10)
const host = normalizeNullable(readArgValue('host') ?? process.env.HOST) ?? '127.0.0.1'
const authToken =
  normalizeNullable(readArgValue('auth-token') ?? process.env.OPENPENCIL_MCP_AUTH_TOKEN) ??
  (typeof config?.authToken === 'string' ? config.authToken.trim() || null : config?.authToken ?? null)
const corsOrigin =
  normalizeNullable(readArgValue('cors-origin') ?? process.env.OPENPENCIL_MCP_CORS_ORIGIN) ??
  (typeof config?.corsOrigin === 'string'
    ? config.corsOrigin.trim() || null
    : config?.corsOrigin ?? null)
const mcpRoot =
  normalizeNullable(readArgValue('mcp-root') ?? process.env.OPENPENCIL_MCP_ROOT) ??
  (typeof config?.mcpRoot === 'string' ? config.mcpRoot.trim() || null : config?.mcpRoot ?? null)
const enableEval =
  readBooleanFlag('enable-eval') ||
  process.env.OPENPENCIL_MCP_EVAL === '1' ||
  config?.enableEval === true

const { app, httpPort } = startServer({
  host,
  httpPort: port,
  wsPort,
  enableEval,
  mcpRoot: mcpRoot ?? process.cwd(),
  authToken,
  corsOrigin
})

serve({ fetch: app.fetch, port: httpPort, hostname: host })

process.stderr.write(`OpenPencil MCP server\n`)
process.stderr.write(`  HTTP:  http://${host}:${httpPort}\n`)
process.stderr.write(`  WS:    ws://${host}:${wsPort}\n`)
process.stderr.write(`  MCP:   http://${host}:${httpPort}/mcp\n`)
