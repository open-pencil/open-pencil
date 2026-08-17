export type CollabActionReceiver = (data: Uint8Array, peerId: string) => void
export type CollabAction = [
  send: (data: Uint8Array, peerId?: string) => void,
  receive: (handler: CollabActionReceiver) => void
]

export interface CollabRoomTransport {
  makeAction(namespace: string): CollabAction
  onPeerJoin(handler: (peerId: string) => void): void
  onPeerLeave(handler: (peerId: string) => void): void
  leave(): Promise<void>
}

export type JoinCollabRoom = (roomId: string) => CollabRoomTransport
