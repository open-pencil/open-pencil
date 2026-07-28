import { afterEach, describe, expect, test } from 'bun:test'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

import { removeDiscoveryFile, writeDiscoveryFile } from '@open-pencil/mcp/discovery'

import { rpc } from '#cli/app-client'

let server: Server | null = null

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve()
      return
    }
    server.close(() => resolve())
  })
  server = null
  await removeDiscoveryFile()
})

describe('CLI app transport discovery', () => {
  test('falls back to discovered TCP when the Unix socket is unavailable', async () => {
    const token = 'cli-test-token'
    server = createServer((request, response) => {
      if (request.url !== '/rpc' || request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(401, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: true, result: { source: 'tcp' } }))
    })
    await new Promise<void>((resolve) => {
      server?.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address() as AddressInfo

    await writeDiscoveryFile({
      pid: process.pid,
      socketPath: join('/tmp', `missing-openpencil-${process.pid}.sock`),
      httpPort: address.port,
      authRequired: true,
      authToken: token,
      version: '0.0.0-test',
      startedAt: new Date().toISOString()
    })

    const result = await rpc('list_documents')
    expect(result).toEqual({ source: 'tcp' })
  })
})
