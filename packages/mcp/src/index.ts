#!/usr/bin/env node
import { serve } from '@hono/node-server'

import { startServer } from './server.js'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    `inkly-mcp-http\n\nStart the Inkly MCP HTTP and WebSocket server.\n\nOptions:\n  --help, -h    Show this help message\n`
  )
  process.exit(0)
}

const port = Number.parseInt(process.env.PORT ?? '7600', 10)
const wsPort = Number.parseInt(process.env.WS_PORT ?? '7601', 10)
const host = process.env.HOST ?? '127.0.0.1'

const { app, httpPort } = startServer({
  httpPort: port,
  wsPort,
  enableEval: process.env.INKLY_MCP_EVAL === '1',
  mcpRoot: process.env.INKLY_MCP_ROOT?.trim() || process.cwd(),
  authToken: process.env.INKLY_MCP_AUTH_TOKEN?.trim() || null,
  corsOrigin: process.env.INKLY_MCP_CORS_ORIGIN?.trim() || null
})

serve({ fetch: app.fetch, port: httpPort, hostname: host })

process.stderr.write(`Inkly MCP server\n`)
process.stderr.write(`  HTTP:  http://${host}:${httpPort}\n`)
process.stderr.write(`  WS:    ws://${host}:${wsPort}\n`)
process.stderr.write(`  MCP:   http://${host}:${httpPort}/mcp\n`)
