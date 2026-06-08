import { describe, expect, test, afterEach } from 'bun:test'
import { createServer, type Server } from 'node:http'

import { WebSocket, WebSocketServer } from 'ws'

import { createBrowserRpcBridge } from '#mcp/browser-rpc'

const AUTH_TOKEN = 'test-bridge-token'
const RPC_BODY = { command: 'get_current_page' }

/**
 * Create a temporary WebSocket server.
 */
function createWsServer(): Promise<{
  httpServer: Server
  wss: WebSocketServer
  url: string
}> {
  return new Promise((resolve, reject) => {
    const httpServer = createServer()
    const wss = new WebSocketServer({ noServer: true })

    httpServer.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    })

    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ httpServer, wss, url: `ws://127.0.0.1:${port}` })
    })
    httpServer.on('error', reject)
  })
}

/**
 * Connect a WebSocket client.
 */
function connectClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

/**
 * Set up a connected pair: one client-side WS and one server-side WS.
 *
 * IMPORTANT: The 'connection' handler is registered BEFORE the client
 * connects, because wss emits 'connection' during the upgrade handshake
 * (before the client receives its 'open' event). Any code that awaits
 * connectClient() first and then registers the connection handler will
 * miss the event.
 */
async function setupWsPair(): Promise<{
  serverWs: WebSocket
  clientWs: WebSocket
  wss: WebSocketServer
  httpServer: Server
}> {
  const srv = await createWsServer()

  const serverWsPromise = new Promise<WebSocket>((resolve) => {
    srv.wss.on('connection', resolve)
  })

  const clientWs = await connectClient(srv.url)
  const serverWs = await serverWsPromise

  return { serverWs, clientWs, wss: srv.wss, httpServer: srv.httpServer }
}

/**
 * Register a server-side WebSocket as the browser on the bridge.
 * Mirrors the wiring in server.ts -> wireConnectionHandling.
 *
 * Bridge handleConnection sends { type: 'register', token } through the
 * server-side WS to the browser. We receive it on the client side and
 * echo it back through the same WS pair.
 */
async function registerBrowser(
  serverWs: WebSocket,
  clientWs: WebSocket,
  bridge: ReturnType<typeof createBrowserRpcBridge>
): Promise<void> {
  // Wire message + close handlers the same way server.ts does
  serverWs.on('message', (raw: Buffer) => {
    const data = Buffer.from(raw as Buffer).toString('utf-8')
    bridge.handleMessage(data, serverWs)
  })
  serverWs.on('close', () => bridge.handleClose(serverWs))

  // Bridge sends register token to the client
  bridge.handleConnection(serverWs)

  // Client receives the register token and echoes it back
  const raw: Buffer = await new Promise<Buffer>((resolve) => {
    clientWs.once('message', resolve)
  })
  const msg = JSON.parse(raw.toString())
  expect(msg.type).toBe('register')
  clientWs.send(JSON.stringify({ type: 'register', token: msg.token }))

  // Yield so the bridge processes the echo before the test continues
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50)
  })
}

describe('BrowserRpcBridge reconnection', () => {
  const servers: { httpServer: Server; wss: WebSocketServer }[] = []

  afterEach(() => {
    for (const s of servers) {
      s.wss.close()
      s.httpServer.close()
    }
    servers.length = 0
  })

  function track(srv: { httpServer: Server; wss: WebSocketServer }) {
    servers.push(srv)
  }

  test('pending requests from old browser are rejected on reconnect (Fix 1)', async () => {
    const pairA = await setupWsPair()
    track(pairA)
    const pairB = await setupWsPair()
    track(pairB)

    const bridge = createBrowserRpcBridge({
      authToken: AUTH_TOKEN,
      onConnectionChange: () => undefined
    })

    // Register the old browser
    await registerBrowser(pairA.serverWs, pairA.clientWs, bridge)

    // Send an RPC — goes to old browser (no response, sits in pending map).
    // Attach .catch() immediately to prevent unhandled rejection when
    // rejectAllPending fires during registerBrowser below.
    let rpcRejection: Error | null = null
    const rpcPromise = bridge.sendRpc(RPC_BODY)
    rpcPromise.catch((e: Error) => {
      rpcRejection = e
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    // A new browser reconnects on a different WS connection.
    // This triggers rejectAllPending() inside registerBrowser.
    const start = Date.now()
    await registerBrowser(pairB.serverWs, pairB.clientWs, bridge)

    // Give the catch handler a tick to capture the rejection
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10)
    })
    expect(rpcRejection?.message).toBe('Browser reconnected')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5_000)
  })

  test('connection waiters survive handleClose and are NOT rejected (Fix 2)', async () => {
    const pair = await setupWsPair()
    track(pair)

    const bridge = createBrowserRpcBridge({
      authToken: AUTH_TOKEN,
      onConnectionChange: () => undefined
    })

    // Register the browser
    await registerBrowser(pair.serverWs, pair.clientWs, bridge)

    // Close the client side — this should trigger serverWs 'close'
    // which calls bridge.handleClose(). Fix 2 ensures that connection
    // waiters are NOT rejected here.
    pair.clientWs.close()
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 200)
    })

    // sendRpc enters waitForConnection() because browserWs is null.
    // The waiter should survive handleClose and stay pending.
    const rpcPromise = bridge.sendRpc(RPC_BODY)

    // Race the waiter against a short timeout — if handleClose wrongly
    // rejects waiters, rpcPromise would settle quickly.
    const raceOutcome = await Promise.race([
      rpcPromise.then(
        (v) => ({ settled: true, value: v }) as const,
        (e) => ({ settled: true, error: (e as Error).message }) as const
      ),
      new Promise<{ settled: false }>((resolve) => {
        setTimeout(() => resolve({ settled: false }), 500)
      })
    ])

    expect(raceOutcome.settled).toBe(false)
  })

  test('connection waiters resolved when browser reconnects after close', async () => {
    const pairA = await setupWsPair()
    track(pairA)

    const bridge = createBrowserRpcBridge({
      authToken: AUTH_TOKEN,
      onConnectionChange: () => undefined
    })

    // Register initial browser
    await registerBrowser(pairA.serverWs, pairA.clientWs, bridge)

    // Close client — triggers serverWs 'close', bridge.handleClose,
    // browserWs set to null, browserRegistered = false
    pairA.clientWs.close()
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 200)
    })

    // sendRpc enters waitForConnection
    const rpcPromise = bridge.sendRpc(RPC_BODY)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    // A new browser connects
    const pairB = await setupWsPair()
    track(pairB)

    const serverWsB = pairB.serverWs
    const clientWsB = pairB.clientWs

    // Wire server-side message/close handlers
    serverWsB.on('message', (raw: Buffer) => {
      const data = Buffer.from(raw as Buffer).toString('utf-8')
      bridge.handleMessage(data, serverWsB)
    })
    serverWsB.on('close', () => bridge.handleClose(serverWsB))

    // Set up client-side handler to respond to incoming RPC requests.
    // Must match the protocol: handleClientRequest sends
    //   { type: 'response', id, ok: true, ...responsePayload(result) }
    // where responsePayload spreads result fields directly (not under a
    // "result" key). handleBrowserResponse then strips type/id via
    // stripEnvelope, so sendRpc resolves with { ok: true, ...result }.
    clientWsB.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'request') {
        clientWsB.send(JSON.stringify({ type: 'response', id: msg.id, ok: true, connected: true }))
      }
    })

    // Bridge sends register token through serverWsB to clientWsB
    bridge.handleConnection(serverWsB)

    // Client receives register token and echoes it back
    const regRaw: Buffer = await new Promise<Buffer>((resolve) => {
      clientWsB.once('message', resolve)
    })
    const reg = JSON.parse(regRaw.toString())
    expect(reg.type).toBe('register')
    clientWsB.send(JSON.stringify({ type: 'register', token: reg.token }))

    // The echo triggers registerBrowser() which resolves the waiter,
    // re-sends the pending RPC, and resolves rpcPromise.
    const result = await rpcPromise
    expect(result).toEqual({ ok: true, connected: true })
  }, 5_000)

  test('sendRpc rejects after timeout when browser never connects', async () => {
    const bridge = createBrowserRpcBridge({
      authToken: AUTH_TOKEN,
      onConnectionChange: () => undefined
    })

    // No browser registered — sendRpc will wait for connection.
    let rpcRejection: Error | null = null
    bridge.sendRpc(RPC_BODY).catch((e: Error) => {
      rpcRejection = e
    })

    // APP_WAIT_TIMEOUT is 10_000 ms. Wait a bit longer.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10_200)
    })

    expect(rpcRejection).not.toBeNull()
    expect(rpcRejection?.message).toContain('OpenPencil app is not connected')
  }, 12_000)
})
