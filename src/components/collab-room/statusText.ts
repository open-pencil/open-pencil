import type { useCollaborationMessages } from '@open-pencil/vue'

import type { RoomStatus } from '@/app/collab/room/status'

type CollaborationMessages = ReturnType<typeof useCollaborationMessages>['value']

/** A room's state in words: "Live · 3 here", "Only you here — …", joining, waiting, or offline. */
export function roomStatusText(
  messages: CollaborationMessages,
  status: RoomStatus,
  peerCount: number
): string {
  if (status === 'live') return messages.statusLive({ count: peerCount + 1 })
  if (status === 'alone') return messages.statusAlone
  if (status === 'waiting') return messages.waitingTitle
  if (status === 'unreachable') return messages.unreachableTitle
  return messages.joiningTitle
}
