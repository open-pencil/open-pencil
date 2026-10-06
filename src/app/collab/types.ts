import type { Color } from '@open-pencil/scene-graph/primitives'

import type { RoomStatus } from '@/app/collab/room/status'
import type { AgentPresence, PersonPoint } from '@/app/presence/types'

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  cursor?: PersonPoint
  selection?: string[]
  /** Agents this person runs, as they publish them. */
  agents: AgentPresence[]
  /** The layer tree format the peer's build syncs, when it says. */
  treeFormat?: number
  /** Whether the peer has the room's file, so a newcomer can get it from them. */
  hasFile?: boolean
}

/** The active tab's room, as the collaboration UI shows it. */
export interface CollabState {
  /** Whether the active tab is in a room. */
  inRoom: boolean
  roomId: string | null
  status: RoomStatus | null
  peers: RemotePeer[]
  localName: string
  localColor: Color
  /** Whether the person has set their own name rather than joining as a generated one. */
  hasChosenName: boolean
}

export const DEFAULT_COLLAB_STATE: CollabState = {
  inRoom: false,
  roomId: null,
  status: null,
  peers: [],
  localName: '',
  localColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  hasChosenName: false
}
