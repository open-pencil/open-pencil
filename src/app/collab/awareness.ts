import { randomIndex } from '@open-pencil/core/random'

import { parsePeer } from '@/app/presence/schema'
import { ROOM_ID_CHARS, ROOM_ID_LENGTH } from '@/constants'

import type { RemotePeer } from './types'

/** People in the room other than us, validated: awareness comes from other browsers. */
export function buildRemotePeers(
  states: Map<number, Record<string, unknown>>,
  localClientId: number
): RemotePeer[] {
  return [...states].flatMap(([clientId, state]) =>
    clientId === localClientId ? [] : (parsePeer(clientId, state) ?? [])
  )
}

export function generateRoomId(): string {
  let result = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    result += ROOM_ID_CHARS[randomIndex(ROOM_ID_CHARS.length)]
  }
  return result
}
