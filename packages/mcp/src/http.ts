#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

import { createServer } from './server.js'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))
const port = parseInt(process.env.PORT ?? '3100', 10)
const host = process.env.HOST ?? '127.0.0.1'
const authToken = process.env.OPENPENCIL_MCP_AUTH_TOKEN?.trim() || null
const corsOrigin = process.env.OPENPENCIL_MCP_CORS_ORIGIN?.trim() || null
const fileRoot = resolve(process.env.OPENPENCIL_MCP_ROOT ?? process.cwd())

const sessions = new Map<string, { server: ReturnType<typeof createServer>; transport: WebStandardStreamableHTTPServerTransport }>()

async function getOrCreateSession(sessionId?: string) {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!
  }

  const id = sessionId ?? randomUUID()
  const server = createServer(pkg.version, {
    enableEval: false,
    fileRoot
  })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => id })
  await server.connect(transport)
  sessions.set(id, { server, transport })
  return { server, transport }
}

const app = new Hono()

if (corsOrigin) {
  app.use('*', cors({
    origin: corsOrigin,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'x-mcp-token',
      'mcp-session-id',
      'Last-Event-ID',
      'mcp-protocol-version'
    ],
    exposeHeaders: ['mcp-session-id', 'mcp-protocol-version']
  }))
}

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    version: pkg.version,
    authRequired: Boolean(authToken),
    evalEnabled: false,
    fileRoot
  })
)

app.all('/mcp', async (c) => {
  if (authToken) {
    const authHeader = c.req.header('authorization')
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : c.req.header('x-mcp-token')
    if (token !== authToken) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  }

  const sessionId = c.req.header('mcp-session-id') ?? undefined
  const { transport } = await getOrCreateSession(sessionId)
  return transport.handleRequest(c.req.raw)
})

const isBun = typeof globalThis.Bun !== 'undefined'

if (isBun) {
  Bun.serve({ fetch: app.fetch, port, hostname: host })
} else {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port, hostname: host })
}

console.log(`OpenPencil MCP server v${pkg.version}`)
console.log(`  Health:  http://${host}:${port}/health`)
console.log(`  MCP:     http://${host}:${port}/mcp`)
console.log(`  Auth:    ${authToken ? 'required (OPENPENCIL_MCP_AUTH_TOKEN)' : 'disabled'}`)
console.log(`  CORS:    ${corsOrigin ?? 'disabled'}`)
console.log(`  Eval:    disabled`)
console.log(`  Root:    ${fileRoot}`)
