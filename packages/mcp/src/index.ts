#!/usr/bin/env node
import { startServer } from './server'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    `openpencil-mcp-http\n\n` +
      `Start the OpenPencil MCP server.\n\n` +
      `The server listens on a Unix domain socket by default.\n` +
      `Optional TCP is available for browser clients.\n\n` +
      `Options:\n` +
      `  --help, -h    Show this help message\n\n` +
      `Environment variables:\n` +
      `  PORT                         TCP port (default: 7600, set to 0 to disable TCP)\n` +
      `  OPENPENCIL_MCP_SOCKET        Override socket path\n` +
      `  OPENPENCIL_MCP_TCP           Set to 1 to enable TCP (TCP is on when PORT > 0, off when PORT=0)\n` +
      `  OPENPENCIL_MCP_AUTH_TOKEN    Bearer token for MCP and RPC auth\n` +
      `  OPENPENCIL_MCP_ROOT          Allowed directory for file-scoped tools\n` +
      `  OPENPENCIL_MCP_EVAL          Set to 1 to enable the eval tool\n` +
      `  OPENPENCIL_MCP_CORS_ORIGIN   Allowed CORS origin\n`
  )
  process.exit(0)
}

const port = Number.parseInt(process.env.PORT ?? '7600', 10)
const enableTcp = process.env.OPENPENCIL_MCP_TCP?.trim() === '1'
const withTcp = enableTcp || port > 0

const handle = await startServer({
  httpPort: withTcp ? port : 0,
  withTcp,
  socketPath: process.env.OPENPENCIL_MCP_SOCKET?.trim() || null,
  enableEval: process.env.OPENPENCIL_MCP_EVAL === '1',
  mcpRoot: process.env.OPENPENCIL_MCP_ROOT?.trim() || process.cwd(),
  // Auth token: unset → auto-generate, empty string → disable auth, otherwise → use value
  authToken:
    process.env.OPENPENCIL_MCP_AUTH_TOKEN === ''
      ? null
      : process.env.OPENPENCIL_MCP_AUTH_TOKEN?.trim() || undefined,
  corsOrigin: process.env.OPENPENCIL_MCP_CORS_ORIGIN?.trim() || null
})

process.stderr.write(`OpenPencil MCP server\n`)
if (handle.socketPath) process.stderr.write(`  Socket: ${handle.socketPath}\n`)
if (handle.httpPort) process.stderr.write(`  HTTP:   http://127.0.0.1:${handle.httpPort}\n`)

// Graceful shutdown on signals
const shutdown = async () => {
  process.stderr.write('\nShutting down MCP server...\n')
  await handle.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown().catch(() => process.exit(1)))
process.on('SIGTERM', () => void shutdown().catch(() => process.exit(1)))
