import { describe, expect, test, afterEach } from 'bun:test'
import { randomUUID } from 'node:crypto'
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

  // Bridge sends register prompt to the client (token is null for security)
  bridge.handleConnection(serverWs)

  // Client receives the register prompt
  const raw: Buffer = await new Promise<Buffer>((resolve) => {
    clientWs.once('message', resolve)
  })
  const msg = JSON.parse(raw.toString())
  expect(msg.type).toBe('register')

  // The browser app sends the register message with the known token.
  // It gets the token from the discovery file or Vite env, not from the prompt.
  clientWs.send(JSON.stringify({ type: 'register', token: AUTH_TOKEN }))

  // Wait for the bridge to process the register message by observing
  // the onConnectionChange callback (isConnected becomes true).
  // Use a one-shot polling approach to avoid the no-multiple-resolved
  // lint rule that flags setInterval-based resolve patterns.
  for (let i = 0; i < 200; i++) {
    if (bridge.isConnected()) break
    await new Promise<void>((r) => {
      setTimeout(r, 5)
    })
  }
  expect(bridge.isConnected()).toBe(true)
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
    const rpcPromise = bridge.sendRpc(RPC_BODY)

    // A new browser reconnects on a different WS connection.
    // This triggers rejectAllPending() inside registerBrowser.
    const start = Date.now()
    await registerBrowser(pairB.serverWs, pairB.clientWs, bridge)

    // Assert the rejection directly instead of sleeping for handler propagation.
    await expect(rpcPromise).rejects.toThrow('Browser reconnected')
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
    // Consume the eventual rejection (after APP_WAIT_TIMEOUT) to prevent
    // an unhandled rejection after the test ends — handleClose intentionally
    // does NOT reject connectionWaiters, so the promise will reject on timeout.
    void rpcPromise.catch(() => undefined)

    try {
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
    } finally {
      bridge.close()
    }
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

    // Bridge sends register prompt through serverWsB to clientWsB
    bridge.handleConnection(serverWsB)

    // Client receives the register prompt and sends the known token
    const regRaw: Buffer = await new Promise<Buffer>((resolve) => {
      clientWsB.once('message', resolve)
    })
    const reg = JSON.parse(regRaw.toString())
    expect(reg.type).toBe('register')
    clientWsB.send(JSON.stringify({ type: 'register', token: AUTH_TOKEN }))

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

    // No browser registered — sendRpc rejects with APP_NOT_CONNECTED.
    await expect(bridge.sendRpc(RPC_BODY)).rejects.toThrow('OpenPencil app is not connected')
  }, 12_000)

  test('response from non-browser WebSocket is ignored (ws guard)', async () => {
    // Set up two independent WS pairs: one for the browser, one for a
    // non-browser client (e.g. a stdio bridge).
    const browserPair = await setupWsPair()
    track(browserPair)
    const clientPair = await setupWsPair()
    track(clientPair)

    const bridge = createBrowserRpcBridge({
      authToken: AUTH_TOKEN,
      onConnectionChange: () => undefined
    })

    // Register the browser
    await registerBrowser(browserPair.serverWs, browserPair.clientWs, bridge)

    // Also wire the non-browser client into the bridge so it can send
    // messages via handleMessage (simulating a stdio bridge WS).
    // Authenticate it first so handleMessage doesn't reject at the auth gate.
    clientPair.serverWs.on('message', (raw: Buffer) => {
      const data = Buffer.from(raw as Buffer).toString('utf-8')
      bridge.handleMessage(data, clientPair.serverWs)
    })
    bridge.handleConnection(clientPair.serverWs)
    await new Promise<void>((resolve) => {
      clientPair.clientWs.send(JSON.stringify({ type: 'auth', token: AUTH_TOKEN }))
      // Wait briefly for the auth message to be processed
      clientPair.clientWs.once('message', () => resolve())
    })

    // Capture the request ID from the browser side. Set up the listener
    // BEFORE sending the RPC to avoid a race where the request message
    // arrives before the handler is attached.
    const capturedIdPromise = new Promise<string>((resolve) => {
      browserPair.clientWs.on('message', function handler(raw: Buffer) {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'request') {
          browserPair.clientWs.off('message', handler)
          resolve(msg.id)
        }
      })
    })

    // Send an RPC — it goes to the real browser.
    const rpcPromise = bridge.sendRpc(RPC_BODY)

    const capturedId = await capturedIdPromise

    // Have the non-browser client inject a fake response with a random UUID.
    // The ws guard (browserWs !== ws) fires because the message arrives from
    // a non-browser WebSocket — it returns before pending.get(msg.id) is
    // reached. The matching-UUID case is tested in the next test.
    const fakeId = randomUUID()
    clientPair.clientWs.send(
      JSON.stringify({ type: 'response', id: fakeId, ok: true, result: 'fake' })
    )

    // Give the fake message time to be processed
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    // Now send the legitimate browser response
    browserPair.clientWs.send(
      JSON.stringify({ type: 'response', id: capturedId, ok: true, real: true })
    )

    // The RPC should resolve with the real browser's response, not the
    // fake one. The ws guard ensures responses from non-browser sockets
    // are silently dropped.
    const result = await rpcPromise
    expect(result).toEqual({ ok: true, real: true })
  })

  test('response with matching UUID from non-browser WebSocket is rejected by ws guard', async () => {
    // This test specifically exercises the browserWs !== ws guard with
    // a matching request UUID, which is the more dangerous attack vector.
    const browserPair = await setupWsPair()
    track(browserPair)
    const attackerPair = await setupWsPair()
    track(attackerPair)

    const bridge = createBrowserRpcBridge({
      authToken: AUTH_TOKEN,
      onConnectionChange: () => undefined
    })

    // Register the browser
    await registerBrowser(browserPair.serverWs, browserPair.clientWs, bridge)

    // Wire the attacker's WS into the bridge so it can send messages.
    // Authenticate it first so handleMessage doesn't reject at the auth gate,
    // ensuring the ws-guard logic is actually tested.
    attackerPair.serverWs.on('message', (raw: Buffer) => {
      const data = Buffer.from(raw as Buffer).toString('utf-8')
      bridge.handleMessage(data, attackerPair.serverWs)
    })
    bridge.handleConnection(attackerPair.serverWs)
    await new Promise<void>((resolve) => {
      attackerPair.clientWs.send(JSON.stringify({ type: 'auth', token: AUTH_TOKEN }))
      attackerPair.clientWs.once('message', () => resolve())
    })

    // Set up the message listener BEFORE sending the RPC to avoid a race
    // where the request arrives before the handler is attached.
    const capturedIdPromise = new Promise<string>((resolve) => {
      browserPair.clientWs.on('message', function handler(raw: Buffer) {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'request') {
          browserPair.clientWs.off('message', handler)
          resolve(msg.id)
        }
      })
    })

    // Send an RPC — it goes to the real browser.
    const rpcPromise = bridge.sendRpc(RPC_BODY)

    const capturedId = await capturedIdPromise
    expect(capturedId).toBeTruthy()
    const requestId = capturedId

    // The attacker sends a fake response with the REAL request UUID
    // from a different WebSocket. The browserWs !== ws guard must
    // prevent this from resolving the pending request.
    attackerPair.clientWs.send(
      JSON.stringify({ type: 'response', id: requestId, ok: true, injected: true })
    )

    // Give the fake message time to be processed
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })

    // Now the real browser responds
    browserPair.clientWs.send(
      JSON.stringify({ type: 'response', id: requestId, ok: true, legitimate: true })
    )

    // The RPC must resolve with the real browser's response, proving
    // the attacker's injection was ignored by the ws guard.
    const result = (await rpcPromise) as { legitimate?: boolean; injected?: boolean }
    expect(result.legitimate).toBe(true)
    expect(result.injected).toBeUndefined()
  })
})
