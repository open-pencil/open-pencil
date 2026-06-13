#!/usr/bin/env node
import { startServer } from '#mcp/server'

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
      `  OPENPENCIL_MCP_TCP           Deprecated — TCP is controlled by PORT (>0 = on, 0 = off)\n` +
      `  OPENPENCIL_MCP_AUTH_TOKEN    Bearer token for MCP and RPC auth\n` +
      `  OPENPENCIL_MCP_ROOT          Allowed directory for file-scoped tools\n` +
      `  OPENPENCIL_MCP_EVAL          Set to 1 to enable the eval tool\n` +
      `  OPENPENCIL_MCP_CORS_ORIGIN   Allowed CORS origin\n`
  )
  process.exit(0)
}

const rawPortText = (process.env.PORT ?? '7600').trim()
// Reject non-digit strings (including hex like "0x50" and partially-numeric like
// "7600abc") — Number.parseInt would silently parse these, masking misconfig.
if (!/^\d+$/.test(rawPortText)) {
  process.stderr.write(`Error: PORT must be an integer in 0–65535, got "${process.env.PORT}"\n`)
  process.exit(1)
}
const rawPort = Number.parseInt(rawPortText, 10)
// Validate PORT: must be an integer in 0–65535. 0 means "disable TCP".
if (rawPort < 0 || rawPort > 65535) {
  process.stderr.write(`Error: PORT must be an integer in 0–65535, got "${process.env.PORT}"\n`)
  process.exit(1)
}
const port = rawPort
// OPENPENCIL_MCP_TCP is accepted for backward compat but has no effect —
// the PORT value alone determines whether TCP is enabled (PORT=0 is the kill switch).
const withTcp = port > 0

const handle = await startServer({
  httpPort: withTcp ? port : 0,
  withTcp,
  socketPath: process.env.OPENPENCIL_MCP_SOCKET?.trim() || null,
  enableEval: process.env.OPENPENCIL_MCP_EVAL === '1',
  mcpRoot: process.env.OPENPENCIL_MCP_ROOT?.trim() || process.cwd(),
  // Auth token: undefined → auto-generate, empty string → disable auth,
  // non-empty → use trimmed value. Whitespace-only is rejected to prevent a
  // silent fallback to an auto-generated token when the operator intended to
  // set an explicit one.
  authToken: (() => {
    const raw = process.env.OPENPENCIL_MCP_AUTH_TOKEN
    if (raw === undefined) return undefined
    if (raw === '') return null
    const trimmed = raw.trim()
    if (!trimmed) {
      process.stderr.write(
        'Error: OPENPENCIL_MCP_AUTH_TOKEN is whitespace-only. Set a real token, or use an empty string to disable auth.\n'
      )
      process.exit(1)
    }
    return trimmed
  })(),
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
