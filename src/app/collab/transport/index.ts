import type { JoinCollabRoom } from '@open-pencil/collab'

import { appRuntimeConfig } from '@/app/runtime/config'

import { joinTestCollabRoom } from './test'
import { joinTrysteroCollabRoom } from './trystero'

function usesTestTransport(): boolean {
  return import.meta.env.DEV && appRuntimeConfig.collaborationTransport === 'test'
}

export const joinCollabRoom: JoinCollabRoom = (roomId) =>
  usesTestTransport() ? joinTestCollabRoom(roomId) : joinTrysteroCollabRoom(roomId)
