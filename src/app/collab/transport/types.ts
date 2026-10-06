export type CollabActionReceiver = (data: Uint8Array, peerId: string) => void
export type CollabAction = [
  send: (data: Uint8Array, peerId?: string) => void,
  receive: (handler: CollabActionReceiver) => void
]

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
  leave(): Promise<void>
}

export type JoinCollabRoom = (roomId: string) => CollabRoomTransport
