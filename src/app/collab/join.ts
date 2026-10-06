import { useCollaborationMessages } from '@open-pencil/vue'

import { parseRoomInput } from '@/app/collab/room/id'
import { joinRoom } from '@/app/collab/rooms'

/**
 * Joins the room in a pasted link or ID, in a tab of its own. False when the text is not a room
 * link or ID, so the caller can say so instead of joining a room nobody shared.
 */
export function useJoinRoom() {
  const messages = useCollaborationMessages()
  return (input: string): boolean => {
    const roomId = parseRoomInput(input)
    if (!roomId) return false
    return joinRoom(roomId, { tabName: messages.value.sharedFile }) !== null
  }
}
