const SIGNALING_PATH = '/api/ws/signaling'

export type SignalingPeerData = {
  roomId: string
  peerId: string
}

type SignalingForwardMessage =
  | {
      type: 'offer'
      targetPeerId: string
      payload: RTCSessionDescriptionInit
    }
  | {
      type: 'answer'
      targetPeerId: string
      payload: RTCSessionDescriptionInit
    }
  | {
      type: 'ice-candidate'
      targetPeerId: string
      payload: RTCIceCandidateInit
    }

type SignalingServerMessage =
  | {
      type: 'welcome'
      peerId: string
      peers: string[]
    }
  | {
      type: 'peer-joined'
      peerId: string
    }
  | {
      type: 'peer-left'
      peerId: string
    }
  | {
      type: 'offer' | 'answer' | 'ice-candidate'
      peerId: string
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit
    }
  | {
      type: 'error'
      message: string
    }

type SignalingSocket = ServerWebSocket<SignalingPeerData>

export interface SignalingServer {
  handleRequest: (request: Request, server: Bun.Server) => Response | undefined | null
  websocket: Bun.WebSocketHandler<SignalingPeerData>
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function send(socket: SignalingSocket, message: SignalingServerMessage) {
  socket.send(JSON.stringify(message))
}

function parseForwardMessage(raw: string): SignalingForwardMessage | null {
  try {
    const message = JSON.parse(raw) as Partial<SignalingForwardMessage>
    const validType =
      message.type === 'offer' || message.type === 'answer' || message.type === 'ice-candidate'
    if (!validType) return null
    if (typeof message.targetPeerId !== 'string' || message.targetPeerId.length === 0) return null
    if (!message.payload || typeof message.payload !== 'object') return null
    return message as SignalingForwardMessage
  } catch {
    return null
  }
}

function roomPeers(rooms: Map<string, Map<string, SignalingSocket>>, roomId: string) {
  let peers = rooms.get(roomId)
  if (!peers) {
    peers = new Map()
    rooms.set(roomId, peers)
  }
  return peers
}

export function createSignalingServer(
  log: (message: string) => void = (message) => process.stderr.write(`${message}\n`)
): SignalingServer {
  const rooms = new Map<string, Map<string, SignalingSocket>>()

  function broadcast(roomId: string, message: SignalingServerMessage, exceptPeerId?: string) {
    const peers = rooms.get(roomId)
    if (!peers) return
    for (const [peerId, socket] of peers) {
      if (peerId === exceptPeerId) continue
      send(socket, message)
    }
  }

  return {
    handleRequest(request, server) {
      const url = new URL(request.url)
      if (url.pathname !== SIGNALING_PATH) return null

      const roomId = url.searchParams.get('room')?.trim()
      if (!roomId) {
        return json(
          {
            error: {
              code: 'missing_room',
              message: 'room query parameter is required'
            }
          },
          400
        )
      }

      const peerId = crypto.randomUUID()
      const upgraded = server.upgrade<SignalingPeerData>(request, {
        data: { roomId, peerId }
      })

      if (upgraded) return undefined

      return json(
        {
          error: {
            code: 'upgrade_failed',
            message: 'WebSocket upgrade failed'
          }
        },
        426
      )
    },
    websocket: {
      open(socket) {
        const { roomId, peerId } = socket.data
        const peers = roomPeers(rooms, roomId)
        const existingPeerIds = [...peers.keys()]
        peers.set(peerId, socket)

        send(socket, {
          type: 'welcome',
          peerId,
          peers: existingPeerIds
        })
        broadcast(roomId, { type: 'peer-joined', peerId }, peerId)

        log(`[inkly-api] signaling connected room=${roomId} peer=${peerId} peers=${peers.size}`)
      },
      message(socket, message) {
        if (typeof message !== 'string') {
          send(socket, { type: 'error', message: 'Expected JSON text message' })
          return
        }

        const parsed = parseForwardMessage(message)
        if (!parsed) {
          send(socket, { type: 'error', message: 'Invalid signaling message' })
          return
        }

        const peers = rooms.get(socket.data.roomId)
        const target = peers?.get(parsed.targetPeerId)
        if (!target) {
          send(socket, { type: 'error', message: 'Target peer not found' })
          return
        }

        send(target, {
          type: parsed.type,
          peerId: socket.data.peerId,
          payload: parsed.payload
        })
      },
      close(socket) {
        const { roomId, peerId } = socket.data
        const peers = rooms.get(roomId)
        if (!peers) return

        peers.delete(peerId)
        if (peers.size === 0) rooms.delete(roomId)
        else broadcast(roomId, { type: 'peer-left', peerId }, peerId)

        log(`[inkly-api] signaling disconnected room=${roomId} peer=${peerId} peers=${peers.size}`)
      }
    }
  }
}
