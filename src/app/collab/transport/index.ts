import { appRuntimeConfig } from '@/app/runtime/config'

import { joinTestCollabRoom } from './test'
import { joinTrysteroCollabRoom } from './trystero'
import type { JoinCollabRoom } from './types'

function usesTestTransport(): boolean {
  return import.meta.env.DEV && appRuntimeConfig.collaborationTransport === 'test'
}

export const joinCollabRoom: JoinCollabRoom = (roomId) =>
  usesTestTransport() ? joinTestCollabRoom(roomId) : joinTrysteroCollabRoom(roomId)

export type { CollabRoomTransport, JoinCollabRoom } from './types'
