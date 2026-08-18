import { IS_BROWSER } from '@/constants'

import { joinTestCollabRoom } from './test'
import { joinTrysteroCollabRoom } from './trystero'
import type { JoinCollabRoom } from './types'

function usesTestTransport(): boolean {
  if (!IS_BROWSER || !import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).get('collabTransport') === 'test'
}

export const joinCollabRoom: JoinCollabRoom = (roomId) =>
  usesTestTransport() ? joinTestCollabRoom(roomId) : joinTrysteroCollabRoom(roomId)

export type { CollabRoomTransport, JoinCollabRoom } from './types'
