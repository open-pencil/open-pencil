import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { McpServer } from '@modelcontextprotocol/server'

import { createMCPSessionManager, type MCPTransport } from '#mcp/server/sessions'
import { registerTools } from '#mcp/tool/registration'

const managers: ReturnType<typeof createMCPSessionManager>[] = []
afterEach(async () => {
  await Promise.all(managers.splice(0).map((manager) => manager.clear()))
})

function manager(options: Partial<Parameters<typeof createMCPSessionManager>[0]> = {}) {
  const instance = createMCPSessionManager({
    serverVersion: '0.0.0',
    registerTools: () => undefined,
    ...options
  })
  managers.push(instance)
  return instance
}

function request(body: unknown, sessionId?: string) {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {})
    },
    body: JSON.stringify(body)
  })
}

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' }
  }
}

async function transport(instance: ReturnType<typeof manager>): Promise<MCPTransport> {
  const result = await instance.resolveTransport(undefined)
  if ('error' in result) throw new Error(result.error)
  return result
}

async function initialized(instance: ReturnType<typeof manager>) {
  const connection = await transport(instance)
  const response = await connection.handleRequest(request(initialize))
  expect(response.status).toBe(200)
  const id = response.headers.get('mcp-session-id')
  if (!id) throw new Error('Missing session id')
  return { connection, id }
}

describe('MCP session lifecycle', () => {
  test('registration and SDK connection failures release reservations and close resources', async () => {
    const close = spyOn(McpServer.prototype, 'close')
    const connect = spyOn(McpServer.prototype, 'connect')
    try {
      const broken = manager({
        registerTools: () => {
          throw new Error('registration failed')
        }
      })
      for (let i = 0; i < 12; i++) {
        const result = await broken.resolveTransport(undefined).catch((error: unknown) => error)
        expect(result).toEqual(new Error('registration failed'))
      }
      expect(close).toHaveBeenCalledTimes(12)
      const instance = manager()
      connect.mockRejectedValueOnce(new Error('connect failed'))
      const result = await instance.resolveTransport(undefined).catch((error: unknown) => error)
      expect(result).toEqual(new Error('connect failed'))
      expect(close).toHaveBeenCalledTimes(13)
      await initialized(instance)
    } finally {
      connect.mockRestore()
      close.mockRestore()
    }
  })

  test('shutdown during SDK connection closes the allocation without publishing a session', async () => {
    const release = deferred<undefined>()
    const connect = spyOn(McpServer.prototype, 'connect').mockImplementationOnce(async () => {
      await release.promise
    })
    try {
      const instance = manager()
      const creating = instance.resolveTransport(undefined)
      const closing = instance.clear()
      release.resolve(undefined)
      expect(await creating).toEqual({ error: 'closed' })
      await closing
      expect(await instance.resolveTransport(undefined)).toEqual({ error: 'closed' })
    } finally {
      release.resolve(undefined)
      connect.mockRestore()
    }
  })
  test('rejected requests do not consume session slots', async () => {
    const instance = manager()
    for (let i = 0; i < 12; i++) {
      const connection = await transport(instance)
      const response = await connection.handleRequest(
        new Request('http://localhost/mcp', {
          headers: { accept: 'text/event-stream' }
        })
      )
      expect(response.status).toBe(400)
    }
    await initialized(instance)
  })

  test('JSON-RPC initialization errors release their allocated session', async () => {
    const ended: string[] = []
    const instance = manager({
      onSessionClosed: (id) => {
        ended.push(id)
      }
    })
    for (let i = 0; i < 12; i++) {
      const connection = await transport(instance)
      await connection.handleRequest(request({ ...initialize, params: { protocolVersion: 42 } }))
    }
    expect(ended).toHaveLength(0)
    await initialized(instance)
  })

  test('concurrent initializations respect capacity and DELETE permits repeated reconnects', async () => {
    const instance = manager()
    const results = await Promise.all(
      Array.from({ length: 12 }, () => instance.resolveTransport(undefined))
    )
    const connections = results.filter((result): result is MCPTransport => !('error' in result))
    expect(connections).toHaveLength(10)
    expect(results.filter((result) => 'error' in result)).toHaveLength(2)
    for (const connection of connections) {
      const response = await connection.handleRequest(request(initialize))
      const id = response.headers.get('mcp-session-id')
      if (!id) throw new Error('Missing session id')
      await instance.deleteSession(id)
    }
    for (let i = 0; i < 12; i++) {
      const { id } = await initialized(instance)
      await instance.deleteSession(id)
      expect(instance.getExistingTransport(id)).toEqual({ error: 'not_found' })
    }
  })

  test('counts resources still closing until cleanup completes', async () => {
    const instance = manager()
    const connections = await Promise.all(Array.from({ length: 10 }, () => initialized(instance)))
    const first = connections[0]
    if (!first) throw new Error('Missing session')
    const release = deferred<undefined>()
    const originalClose = first.connection.close
    const close = spyOn(first.connection, 'close').mockImplementationOnce(async () => {
      await release.promise
      await originalClose()
    })
    try {
      const closing = instance.deleteSession(first.id)
      expect(await instance.resolveTransport(undefined)).toEqual({ error: 'too_many' })
      release.resolve(undefined)
      await closing
      await initialized(instance)
    } finally {
      release.resolve(undefined)
      close.mockRestore()
    }
  })
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('MCP idle expiration', () => {
  test('completed cancelled tools do not pin sessions or send a JSON-RPC response', async () => {
    const started = deferred<undefined>()
    const finish = deferred<undefined>()
    const instance = manager({
      sessionIdleTimeoutMs: 1000,
      registerTools: (server, agentSession, onToolSettled) =>
        registerTools(server, {
          policy: { allowEval: false, disabledTools: [], scope: 'document' },
          agentSession,
          onToolSettled,
          sendRPC: async () => {
            started.resolve(undefined)
            await finish.promise
            return { ok: true, result: { id: 'page', name: 'Page' } }
          }
        })
    })
    const { connection, id } = await initialized(instance)
    const pending = connection.handleRequest(
      request(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'get_current_page', arguments: {} }
        },
        id
      )
    )
    await started.promise
    try {
      const cancelled = await connection.handleRequest(
        request(
          {
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: { requestId: 2 }
          },
          id
        )
      )
      expect(cancelled.status).toBe(202)
      const clockWhileRunning = spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000)
      try {
        expect(instance.getExistingTransport(id)).toBe(connection)
      } finally {
        clockWhileRunning.mockRestore()
      }
      finish.resolve(undefined)
      const response = await pending
      expect(response.status).toBe(202)
      expect(await response.text()).toBe('')
      const ping = await connection.handleRequest(
        request({ jsonrpc: '2.0', id: 3, method: 'ping' }, id)
      )
      expect(ping.status).toBe(200)
      const clock = spyOn(Date, 'now').mockReturnValue(Date.now() + 1001)
      try {
        expect(instance.getExistingTransport(id)).toEqual({ error: 'not_found' })
      } finally {
        clock.mockRestore()
      }
    } finally {
      finish.resolve(undefined)
      await instance.clear()
      await pending
    }
  })

  test.each(['DELETE', 'shutdown'])(
    '%s closes pending HTTP requests and aborts SDK handlers',
    async (action) => {
      const started = deferred<AbortSignal>()
      const finish = deferred<undefined>()
      const instance = manager({
        registerTools: (server) => {
          server.registerTool('wait', {}, async (context) => {
            started.resolve(context.mcpReq.signal)
            await finish.promise
            return { content: [] }
          })
        }
      })
      const { connection, id } = await initialized(instance)
      const pending = connection.handleRequest(
        request(
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'wait', arguments: {} }
          },
          id
        )
      )
      const signal = await started.promise
      try {
        if (action === 'DELETE') {
          const response = await connection.handleRequest(
            new Request('http://localhost/mcp', {
              method: 'DELETE',
              headers: { 'mcp-session-id': id }
            })
          )
          expect(response.status).toBe(200)
          await instance.deleteSession(id)
        } else {
          await instance.clear()
        }
        expect(signal.aborted).toBe(true)
        expect((await pending).status).toBe(404)
      } finally {
        finish.resolve(undefined)
      }
    }
  )

  test('reclaims abandoned sessions in the background without another allocation', async () => {
    const ended = deferred<string>()
    const instance = manager({ sessionIdleTimeoutMs: 20, onSessionClosed: ended.resolve })
    const { id } = await initialized(instance)
    const clock = spyOn(Date, 'now').mockReturnValue(Date.now() + 100)
    try {
      expect(await ended.promise).toBe(id)
      expect(instance.getExistingTransport(id)).toEqual({ error: 'not_found' })
      await initialized(instance)
    } finally {
      clock.mockRestore()
    }
  })

  test('expires an existing ID before touching it, and permits disabling expiration', async () => {
    const instance = manager({ sessionIdleTimeoutMs: 20 })
    const persistent = manager({ sessionIdleTimeoutMs: 0 })
    const expired = await initialized(instance)
    const retained = await initialized(persistent)
    const clock = spyOn(Date, 'now').mockReturnValue(Date.now() + 1_000_000)
    try {
      expect(instance.getExistingTransport(expired.id)).toEqual({ error: 'not_found' })
      expect(persistent.getExistingTransport(retained.id)).toBe(retained.connection)
    } finally {
      clock.mockRestore()
    }
  })

  test('protects a pending tool call and starts its idle lifetime at completion', async () => {
    const started = deferred<undefined>()
    const finish = deferred<undefined>()
    const instance = manager({
      sessionIdleTimeoutMs: 1000,
      registerTools: (server) => {
        server.registerTool('wait', {}, async () => {
          started.resolve(undefined)
          await finish.promise
          return { content: [] }
        })
      }
    })
    const { connection, id } = await initialized(instance)
    const disconnect = new AbortController()
    const response = connection.handleRequest(
      new Request(
        request(
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'wait', arguments: {} }
          },
          id
        ),
        { signal: disconnect.signal }
      )
    )
    await started.promise
    disconnect.abort()
    const future = Date.now() + 10_000
    const clock = spyOn(Date, 'now').mockReturnValue(future)
    try {
      expect(instance.getExistingTransport(id)).toBe(connection)
      finish.resolve(undefined)
      expect((await response).status).toBe(200)
      clock.mockReturnValue(future + 999)
      expect(instance.getExistingTransport(id)).toBe(connection)
      clock.mockReturnValue(future + 1000)
      expect(instance.getExistingTransport(id)).toEqual({ error: 'not_found' })
    } finally {
      finish.resolve(undefined)
      clock.mockRestore()
    }
  })

  test('SSE disconnection preserves the session, while idle expiration closes its stream', async () => {
    const instance = manager({ sessionIdleTimeoutMs: 1000 })
    const { connection, id } = await initialized(instance)
    const get = () =>
      connection.handleRequest(
        new Request('http://localhost/mcp', {
          headers: { accept: 'text/event-stream', 'mcp-session-id': id }
        })
      )
    const first = await get()
    await first.body?.cancel()
    expect(instance.getExistingTransport(id)).toBe(connection)
    const ping = await connection.handleRequest(
      request({ jsonrpc: '2.0', id: 2, method: 'ping' }, id)
    )
    expect(ping.status).toBe(200)
    const second = await get()
    const reader = second.body?.getReader()
    if (!reader) throw new Error('Missing SSE stream')
    const clock = spyOn(Date, 'now').mockReturnValue(Date.now() + 1000)
    try {
      expect(instance.getExistingTransport(id)).toEqual({ error: 'not_found' })
      expect((await reader.read()).done).toBe(true)
    } finally {
      clock.mockRestore()
      await reader.cancel()
    }
  })

  test('DELETE closes SSE and notifies once before capacity is reused', async () => {
    const closed: string[] = []
    const instance = manager({
      onSessionClosed: (id) => {
        closed.push(id)
      }
    })
    const { connection, id } = await initialized(instance)
    const sse = await connection.handleRequest(
      new Request('http://localhost/mcp', {
        headers: { accept: 'text/event-stream', 'mcp-session-id': id }
      })
    )
    const response = await connection.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'DELETE',
        headers: { 'mcp-session-id': id }
      })
    )
    await instance.deleteSession(id)
    expect(response.status).toBe(200)
    expect(closed).toEqual([id])
    expect(instance.getExistingTransport(id)).toEqual({ error: 'not_found' })
    expect((await sse.body?.getReader().read())?.done).toBe(true)
    await initialized(instance)
    await instance.clear()
    expect(closed.filter((value) => value === id)).toHaveLength(1)
  })
})
