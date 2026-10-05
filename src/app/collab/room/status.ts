/**
 * Where a room tab stands, from what this peer knows:
 * - `joining`: just opened, while this device's saved copy loads and peers answer;
 * - `waiting`: nothing to show yet, because nobody with the room is online;
 * - `live`: the room's document is here and other people are too;
 * - `alone`: the room's document is here, from this device's copy, and nobody else is.
 */
export type RoomStatus = 'joining' | 'waiting' | 'live' | 'alone'

export interface RoomStatusInput {
  /** Whether the room's root is known, from a peer or from this device's saved copy. */
  hasDocument: boolean
  /** Whether this device's saved copy of the room has loaded. */
  savedCopyLoaded: boolean
  /** Whether the room has been open long enough that a missing document means nobody has it. */
  waitedLong: boolean
  peerCount: number
}

export function deriveRoomStatus({
  hasDocument,
  savedCopyLoaded,
  waitedLong,
  peerCount
}: RoomStatusInput): RoomStatus {
  if (hasDocument) return peerCount > 0 ? 'live' : 'alone'
  if (!savedCopyLoaded || !waitedLong) return 'joining'
  return 'waiting'
}

/** Whether the room's document is shown, rather than the joining or waiting screen. */
export function showsRoomDocument(status: RoomStatus): boolean {
  return status === 'live' || status === 'alone'
}
