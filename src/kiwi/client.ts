/**
 * Figma Multiplayer WebSocket Client
 *
 * High-level interface for connecting to Figma's multiplayer server
 * and creating/modifying nodes directly via WebSocket.
 *
 * Performance: ~1000 nodes in 15-20ms (vs 50-100s via plugin API)
 */

import {
  initCodec,
  encodeMessage,
  decodeMessage,
  decompress,
  createNodeChangesMessage,
  type NodeChange,
  type FigmaMessage
} from './codec.ts'
import {
  buildMultiplayerUrl,
  MESSAGE_TYPES,
  isZstdCompressed,
  hasFigWireHeader,
  skipFigWireHeader,
  isKiwiMessage,
  getKiwiMessageType
} from './protocol.ts'

interface ChromeDevToolsTarget {
  id: string
  url: string
  title: string
  type: string
  webSocketDebuggerUrl: string
}

export interface SessionInfo {
  sessionID: number
  reconnectSequenceNumber: number
}

export interface ConnectionOptions {
  connectionTimeout?: number
  onMessage?: (message: FigmaMessage) => void
  onError?: (error: Error) => void
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'ready'

export class FigmaMultiplayerClient {
  private fileKey: string
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private sessionInfo: SessionInfo | null = null
  private localIDCounter: number
  private options: ConnectionOptions

  constructor(fileKey: string, options: ConnectionOptions = {}) {
    this.fileKey = fileKey
    this.localIDCounter = Date.now() % 10000000
    this.options = {
      connectionTimeout: 30000,
      ...options
    }
  }

  /**
   * Connect to Figma multiplayer server
   */
  async connect(cookies: string): Promise<SessionInfo> {
    if (this.state !== 'disconnected') {
      throw new Error(`Cannot connect: state is ${this.state}`)
    }

    await initCodec()
    this.state = 'connecting'

    return new Promise((resolve, reject) => {
      const url = buildMultiplayerUrl(this.fileKey)

      this.ws = new WebSocket(url, {
        headers: {
          Cookie: cookies,
          Origin: 'https://www.figma.com'
        }
      })

      this.ws.binaryType = 'arraybuffer'

      const timeout = setTimeout(() => {
        this.close()
        reject(new Error('Connection timeout'))
      }, this.options.connectionTimeout)

      let sessionID = 0
      let reconnectSequenceNumber = 0
      let joinEndReceived = false

      this.ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return

        let data: Uint8Array = new Uint8Array(event.data as ArrayBuffer)

        // Skip fig-wire header if present
        if (hasFigWireHeader(data)) {
          data = new Uint8Array(skipFigWireHeader(data))
        }

        if (!isZstdCompressed(data)) return

        try {
          const decompressed = decompress(data)

          // Skip non-Kiwi message data (e.g., schema definitions)
          if (!isKiwiMessage(decompressed)) return

          const msgType = getKiwiMessageType(decompressed)
          if (!msgType) return

          // JOIN_END: sync complete
          if (msgType === MESSAGE_TYPES.JOIN_END) {
            joinEndReceived = true
          }

          // SIGNAL: extract reconnect-sequence-number
          if (msgType === MESSAGE_TYPES.SIGNAL) {
            const str = new TextDecoder().decode(decompressed)
            const match = str.match(/reconnect-sequence-number[^\d]*(\d+)/)
            if (match?.[1]) {
              reconnectSequenceNumber = parseInt(match[1])
            }
          }

          // Forward messages when ready
          if (this.options.onMessage && this.state === 'ready') {
            try {
              const message = decodeMessage(data)
              this.options.onMessage(message)
            } catch {
              // Ignore decode errors
            }
          }

          // Check if handshake complete
          // Note: sessionID may be 0 if Figma changed protocol; caller gets it from plugin API
          if (joinEndReceived && (this.state === 'connecting' || this.state === 'connected')) {
            clearTimeout(timeout)
            this.state = 'ready'
            this.sessionInfo = { sessionID: sessionID || 0, reconnectSequenceNumber }
            resolve(this.sessionInfo)
          }
        } catch {
          // Ignore parse errors
        }
      }

      this.ws.onopen = () => {
        this.state = 'connected'
      }

      this.ws.onerror = () => {
        clearTimeout(timeout)
        const error = new Error('WebSocket connection failed')
        this.options.onError?.(error)
        if (this.state === 'connecting') {
          reject(error)
        }
      }

      this.ws.onclose = () => {
        clearTimeout(timeout)
        const wasConnecting = this.state === 'connecting'
        this.state = 'disconnected'
        this.ws = null
        if (wasConnecting) {
          reject(new Error('Connection closed during handshake'))
        }
      }
    })
  }

  /**
   * Send node changes to Figma (fire and forget)
   */
  async sendNodeChanges(nodeChanges: NodeChange[]): Promise<void> {
    if (this.state !== 'ready' || !this.ws || !this.sessionInfo) {
      throw new Error('Not connected')
    }

    const message = createNodeChangesMessage(
      this.sessionInfo.sessionID,
      this.sessionInfo.reconnectSequenceNumber,
      nodeChanges
    )

    const encoded = encodeMessage(message)
    this.ws.send(encoded.buffer as ArrayBuffer)
  }

  /**
   * Send node changes and wait for server ACK (NODE_CHANGES echo)
   * This guarantees nodes are synced before returning
   */
  async sendNodeChangesSync(nodeChanges: NodeChange[], timeout = 5000): Promise<void> {
    if (this.state !== 'ready' || !this.ws || !this.sessionInfo) {
      throw new Error('Not connected')
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ws?.removeEventListener('message', handler)
        reject(new Error('ACK timeout'))
      }, timeout)

      const handler = (event: MessageEvent) => {
        if (!(event.data instanceof ArrayBuffer)) return

        let data: Uint8Array = new Uint8Array(event.data as ArrayBuffer)
        if (hasFigWireHeader(data)) data = new Uint8Array(skipFigWireHeader(data))
        if (!isZstdCompressed(data)) return

        try {
          const dec = decompress(data)
          if (isKiwiMessage(dec) && getKiwiMessageType(dec) === MESSAGE_TYPES.NODE_CHANGES) {
            clearTimeout(timer)
            this.ws?.removeEventListener('message', handler)
            resolve()
          }
        } catch {}
      }

      this.ws?.addEventListener('message', handler)
      void this.sendNodeChanges(nodeChanges)
    })
  }

  /**
   * Generate unique local ID for new nodes
   */
  nextLocalID(): number {
    return this.localIDCounter++
  }

  /**
   * Get current session info
   */
  getSession(): SessionInfo | null {
    return this.sessionInfo
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.state === 'ready'
  }

  /**
   * Check if connection is still alive
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state = 'disconnected'
    this.sessionInfo = null
  }
}

/**
 * Get Figma cookies from Chrome DevTools Protocol
 *
 * Requires Chrome/Figma to be running with:
 *   --remote-debugging-port=9222
 */
export async function getCookiesFromDevTools(pageId?: string): Promise<string> {
  // Get list of pages if no ID provided
  if (!pageId) {
    const listResponse = await fetch('http://localhost:9222/json')
    const targets = (await listResponse.json()) as ChromeDevToolsTarget[]
    const figmaTarget = targets.find((t) => t.url.includes('figma.com'))
    if (!figmaTarget) {
      throw new Error('No Figma tab found. Open Figma in Chrome with --remote-debugging-port=9222')
    }
    pageId = figmaTarget.id
  }

  const wsUrl = `ws://localhost:9222/devtools/page/${pageId}`

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('DevTools connection timeout'))
    }, 5000)

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Network.getCookies',
          params: { urls: ['https://www.figma.com'] }
        })
      )
    }

    ws.onmessage = (e) => {
      clearTimeout(timeout)
      const data = JSON.parse(e.data as string)
      if (data.result?.cookies) {
        ws.close()
        const cookieString = data.result.cookies
          .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
          .join('; ')
        resolve(cookieString)
      }
    }

    ws.onerror = () => {
      clearTimeout(timeout)
      reject(
        new Error(
          'Cannot connect to Chrome DevTools. Is Chrome running with --remote-debugging-port=9222?'
        )
      )
    }
  })
}

/**
 * Parse Figma file key from URL
 */
export function parseFileKey(urlOrKey: string): string {
  if (!urlOrKey.includes('/')) {
    return urlOrKey
  }
  const match = urlOrKey.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
  if (!match?.[1]) {
    throw new Error('Invalid Figma URL')
  }
  return match[1]
}
