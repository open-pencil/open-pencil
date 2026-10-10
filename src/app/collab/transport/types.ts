export type CollabActionReceiver = (data: Uint8Array, peerId: string) => void
export type CollabAction = [
  send: (data: Uint8Array, peerId?: string) => void,
  receive: (handler: CollabActionReceiver) => void
]

/** Audio between peers in a room, for voice calls. */
export interface CollabMediaTransport {
  /** Starts sending a local track to one peer. */
  addTrack(track: MediaStreamTrack, stream: MediaStream, peerId: string): void
  removeTrack(track: MediaStreamTrack, peerId: string): void
  /** Swaps what a peer receives without renegotiating, as when the microphone changes. */
  replaceTrack(previous: MediaStreamTrack, next: MediaStreamTrack, peerId: string): void
  onPeerTrack(handler: (track: MediaStreamTrack, peerId: string) => void): void
  /** The connection to a peer, where its audio levels are read. */
  connection(peerId: string): RTCPeerConnection | undefined
}

export interface CollabRoomTransport {
  makeAction(namespace: string): CollabAction
  onPeerJoin(handler: (peerId: string) => void): void
  onPeerLeave(handler: (peerId: string) => void): void
  /**
   * Whether this peer has reached the service that introduces peers to each other, so that
   * silence from the room means nobody is in it rather than that nobody could hear us yet.
   */
  signalingConnected(): boolean
  /** How long after reaching that service everyone already in the room has met this peer. */
  readonly discoveryMs: number
  /** Null where the transport carries no media, so people can be in a call but not heard. */
  readonly media: CollabMediaTransport | null
  leave(): Promise<void>
}

export type JoinCollabRoom = (roomId: string) => CollabRoomTransport
