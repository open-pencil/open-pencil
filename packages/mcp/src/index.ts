#!/usr/bin/env node
import { serve } from '@hono/node-server'

import { startServer } from './server.js'

const port = parseInt(process.env.PORT ?? '7600', 10)
const wsPort = parseInt(process.env.WS_PORT ?? '7601', 10)
const host = process.env.HOST ?? '127.0.0.1'

const { app, httpPort } = startServer({
  httpPort: port,
  wsPort,
  enableEval: process.env.OPENPENCIL_MCP_EVAL === '1',
  authToken: process.env.OPENPENCIL_MCP_AUTH_TOKEN?.trim() || null,
  corsOrigin: process.env.OPENPENCIL_MCP_CORS_ORIGIN?.trim() || null
})

serve({ fetch: app.fetch, port: httpPort, hostname: host })

process.stderr.write(`OpenPencil MCP server\n`)
process.stderr.write(`  HTTP:  http://${host}:${httpPort}\n`)
process.stderr.write(`  WS:    ws://${host}:${wsPort}\n`)
process.stderr.write(`  MCP:   http://${host}:${httpPort}/mcp\n`)
