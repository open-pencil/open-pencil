import * as awarenessProtocol from 'y-protocols/awareness'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

type SignalingIncomingMessage =
  | {
      type: 'welcome'
      peerId: string
      peers: string[]
    }
  | {
      type: 'peer-joined' | 'peer-left'
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

type SignalingOutgoingMessage =
  | {
      type: 'offer' | 'answer'
      targetPeerId: string
      payload: RTCSessionDescriptionInit
    }
  | {
      type: 'ice-candidate'
      targetPeerId: string
      payload: RTCIceCandidateInit
    }

type PeerConnectionEntry = {
  peerId: string
  connection: RTCPeerConnection
  channel: RTCDataChannel | null
  pendingCandidates: RTCIceCandidateInit[]
  remoteAwarenessClientId: number | null
}

type ProviderReady = {
  peerCount: number
}

type ProviderOptions = {
  roomId: string
  ydoc: Y.Doc
  awareness: Awareness
}

export type WebRtcProviderConnection = {
  disconnect: () => void
  ready: Promise<ProviderReady>
}

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
}

const REMOTE_YDOC_ORIGIN = Symbol('inkly-remote-ydoc')
const REMOTE_AWARENESS_ORIGIN = Symbol('inkly-remote-awareness')
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const enum DataMessageType {
  Hello = 0,
  YjsUpdate = 1,
  Awareness = 2,
  SyncStep1 = 3,
  SyncReply = 4
}

function createSignalingUrl(roomId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws/signaling?room=${encodeURIComponent(roomId)}`
}

function encodeFrame(type: DataMessageType, payload?: Uint8Array) {
  const data = payload ?? new Uint8Array(0)
  const frame = new Uint8Array(data.length + 1)
  frame[0] = type
  frame.set(data, 1)
  return frame.buffer
}

async function toUint8Array(data: Blob | ArrayBuffer | string): Promise<Uint8Array> {
  if (typeof data === 'string') return textEncoder.encode(data)
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer())
  return new Uint8Array(data)
}

function sendSignal(socket: WebSocket, message: SignalingOutgoingMessage) {
  socket.send(JSON.stringify(message))
}

export function connectWebRtcProvider({
  roomId,
  ydoc,
  awareness
}: ProviderOptions): WebRtcProviderConnection {
  const socket = new WebSocket(createSignalingUrl(roomId))
  const peers = new Map<string, PeerConnectionEntry>()
  let disposed = false
  let localPeerId: string | null = null
  let resolveReady: ((value: ProviderReady) => void) | null = null
  let rejectReady: ((reason?: unknown) => void) | null = null

  const ready = new Promise<ProviderReady>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  function removePeer(peerId: string) {
    const peer = peers.get(peerId)
    if (!peer) return
    peers.delete(peerId)
    peer.channel?.close()
    peer.connection.close()
    if (peer.remoteAwarenessClientId !== null) {
      awarenessProtocol.removeAwarenessStates(
        awareness,
        [peer.remoteAwarenessClientId],
        'peer-disconnected'
      )
    }
  }

  function disconnect() {
    if (disposed) return
    disposed = true
    for (const peerId of [...peers.keys()]) {
      removePeer(peerId)
    }
    socket.close()
  }

  function broadcastFrame(type: DataMessageType, payload: Uint8Array) {
    for (const peer of peers.values()) {
      if (peer.channel?.readyState === 'open') {
        peer.channel.send(encodeFrame(type, payload))
      }
    }
  }

  async function handleDataMessage(peer: PeerConnectionEntry, message: Blob | ArrayBuffer | string) {
    const frame = await toUint8Array(message)
    const type = frame[0]
    const payload = frame.subarray(1)

    if (type === DataMessageType.Hello) {
      const parsed = JSON.parse(textDecoder.decode(payload)) as { awarenessClientId?: number }
      peer.remoteAwarenessClientId =
        typeof parsed.awarenessClientId === 'number' ? parsed.awarenessClientId : null
      return
    }

    if (type === DataMessageType.YjsUpdate) {
      Y.applyUpdate(ydoc, payload, REMOTE_YDOC_ORIGIN)
      return
    }

    if (type === DataMessageType.Awareness) {
      awarenessProtocol.applyAwarenessUpdate(awareness, payload, REMOTE_AWARENESS_ORIGIN)
      return
    }

    if (type === DataMessageType.SyncStep1) {
      const update = Y.encodeStateAsUpdate(ydoc, payload)
      peer.channel?.send(encodeFrame(DataMessageType.SyncReply, update))
      return
    }

    if (type === DataMessageType.SyncReply) {
      Y.applyUpdate(ydoc, payload, REMOTE_YDOC_ORIGIN)
    }
  }

  function sendInitialPeerState(peer: PeerConnectionEntry) {
    if (peer.channel?.readyState !== 'open') return
    peer.channel.send(
      encodeFrame(
        DataMessageType.Hello,
        textEncoder.encode(JSON.stringify({ awarenessClientId: awareness.clientID }))
      )
    )
    peer.channel.send(encodeFrame(DataMessageType.SyncStep1, Y.encodeStateVector(ydoc)))

    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID])
    peer.channel.send(encodeFrame(DataMessageType.Awareness, update))
  }

  function attachChannel(peer: PeerConnectionEntry, channel: RTCDataChannel) {
    peer.channel = channel
    channel.binaryType = 'arraybuffer'
    channel.onopen = () => {
      sendInitialPeerState(peer)
    }
    channel.onmessage = (event) => {
      void handleDataMessage(peer, event.data)
    }
    channel.onclose = () => {
      removePeer(peer.peerId)
    }
  }

  function flushPendingCandidates(peer: PeerConnectionEntry) {
    if (!peer.connection.remoteDescription) return
    for (const candidate of peer.pendingCandidates.splice(0)) {
      void peer.connection.addIceCandidate(candidate)
    }
  }

  function createPeer(peerId: string, initiator: boolean) {
    const existing = peers.get(peerId)
    if (existing) return existing

    const connection = new RTCPeerConnection(RTC_CONFIGURATION)
    const peer: PeerConnectionEntry = {
      peerId,
      connection,
      channel: null,
      pendingCandidates: [],
      remoteAwarenessClientId: null
    }
    peers.set(peerId, peer)

    connection.onicecandidate = (event) => {
      if (!event.candidate || socket.readyState !== WebSocket.OPEN) return
      sendSignal(socket, {
        type: 'ice-candidate',
        targetPeerId: peerId,
        payload: event.candidate.toJSON()
      })
    }
    connection.ondatachannel = (event) => {
      attachChannel(peer, event.channel)
    }
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        removePeer(peerId)
      }
    }

    if (initiator) {
      attachChannel(peer, connection.createDataChannel('inkly-yjs'))
    }

    return peer
  }

  async function createOffer(peerId: string) {
    const peer = createPeer(peerId, true)
    const offer = await peer.connection.createOffer()
    await peer.connection.setLocalDescription(offer)
    if (socket.readyState === WebSocket.OPEN) {
      sendSignal(socket, {
        type: 'offer',
        targetPeerId: peerId,
        payload: offer
      })
    }
  }

  async function handleOffer(peerId: string, payload: RTCSessionDescriptionInit) {
    const peer = createPeer(peerId, false)
    await peer.connection.setRemoteDescription(payload)
    flushPendingCandidates(peer)
    const answer = await peer.connection.createAnswer()
    await peer.connection.setLocalDescription(answer)
    if (socket.readyState === WebSocket.OPEN) {
      sendSignal(socket, {
        type: 'answer',
        targetPeerId: peerId,
        payload: answer
      })
    }
  }

  async function handleAnswer(peerId: string, payload: RTCSessionDescriptionInit) {
    const peer = createPeer(peerId, false)
    await peer.connection.setRemoteDescription(payload)
    flushPendingCandidates(peer)
  }

  function handleIceCandidate(peerId: string, payload: RTCIceCandidateInit) {
    const peer = createPeer(peerId, false)
    if (peer.connection.remoteDescription) {
      void peer.connection.addIceCandidate(payload)
      return
    }
    peer.pendingCandidates.push(payload)
  }

  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_YDOC_ORIGIN) return
    broadcastFrame(DataMessageType.YjsUpdate, update)
  })

  awareness.on(
    'update',
    (
      {
        added,
        updated,
        removed
      }: {
        added: number[]
        updated: number[]
        removed: number[]
      },
      origin: unknown
    ) => {
      if (origin === REMOTE_AWARENESS_ORIGIN) return
      const changedClients = [...added, ...updated, ...removed]
      if (changedClients.length === 0) return
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      broadcastFrame(DataMessageType.Awareness, update)
    }
  )

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data as string) as SignalingIncomingMessage

    if (message.type === 'welcome') {
      localPeerId = message.peerId
      resolveReady?.({ peerCount: message.peers.length })
      resolveReady = null
      rejectReady = null
      for (const peerId of message.peers) {
        void createOffer(peerId)
      }
      return
    }

    if (message.type === 'peer-joined') {
      if (message.peerId !== localPeerId) createPeer(message.peerId, false)
      return
    }

    if (message.type === 'peer-left') {
      removePeer(message.peerId)
      return
    }

    if (message.type === 'offer') {
      void handleOffer(message.peerId, message.payload as RTCSessionDescriptionInit)
      return
    }

    if (message.type === 'answer') {
      void handleAnswer(message.peerId, message.payload as RTCSessionDescriptionInit)
      return
    }

    if (message.type === 'ice-candidate') {
      handleIceCandidate(message.peerId, message.payload as RTCIceCandidateInit)
      return
    }

    console.warn('[collab] signaling error:', message.message)
  })

  socket.addEventListener('close', () => {
    for (const peerId of [...peers.keys()]) {
      removePeer(peerId)
    }
    if (!disposed) {
      rejectReady?.(new Error('Signaling connection closed before ready'))
      resolveReady = null
      rejectReady = null
    }
  })

  socket.addEventListener('error', () => {
    if (!disposed) {
      rejectReady?.(new Error('Signaling connection failed'))
      resolveReady = null
      rejectReady = null
    }
  })

  return { disconnect, ready }
}
