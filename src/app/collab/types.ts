import type {
  CollaborationPrincipal,
  CollaborationTicket,
  DocumentPermission
} from '@open-pencil/cloud/contract'
import type { Color } from '@open-pencil/scene-graph/primitives'

export type CollaborationIdentitySource = 'local' | 'cloud'

export type CollaborationIdentity = {
  source: CollaborationIdentitySource
  principal: CollaborationPrincipal | null
  permission: DocumentPermission | null
  serverEnforcedWrites: boolean
}

export type CloudCollaborationCredentials = {
  ticket: CollaborationTicket
  refresh: () => Promise<CollaborationTicket>
}

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  identity: CollaborationIdentity
  cursor?: { x: number; y: number; pageId: string }
  selection?: string[]
}

export interface CollabState {
  connected: boolean
  roomId: string | null
  peers: RemotePeer[]
  localName: string
  localColor: Color
  identity: CollaborationIdentity
}

export const DEFAULT_COLLAB_STATE: CollabState = {
  connected: false,
  roomId: null,
  peers: [],
  localName: '',
  localColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  identity: {
    source: 'local',
    principal: null,
    permission: null,
    serverEnforcedWrites: false
  }
}
