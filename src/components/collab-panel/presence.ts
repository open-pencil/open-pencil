import type { Color } from '@open-pencil/scene-graph/primitives'

import type { RemotePeer } from '@/app/collab/types'
import type { AgentPresence, AgentStatus, FollowTarget } from '@/app/presence/types'

export interface PresenceAgentRow {
  id: string
  name: string
  status: AgentStatus
  /** The page the agent works on, when it is working. */
  page?: string
  renamable: boolean
}

export interface PresencePersonRow {
  /** Undefined for ourselves, who cannot be followed. */
  clientId?: number
  name: string
  color: Color
  agents: PresenceAgentRow[]
}

function agentRows(
  agents: readonly AgentPresence[],
  pageName: (pageId: string) => string | undefined,
  renamable: boolean
): PresenceAgentRow[] {
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    page: agent.status !== 'idle' && agent.cursor ? pageName(agent.cursor.pageId) : undefined,
    renamable
  }))
}

/** Ourselves first, then everyone else in the room, each with the agents they run. */
export function presenceRows(
  self: { name: string; color: Color; agents: readonly AgentPresence[] },
  peers: readonly RemotePeer[],
  pageName: (pageId: string) => string | undefined
): PresencePersonRow[] {
  return [
    { name: self.name, color: self.color, agents: agentRows(self.agents, pageName, true) },
    ...peers.map((peer) => ({
      clientId: peer.clientId,
      name: peer.name,
      color: peer.color,
      agents: agentRows(peer.agents, pageName, false)
    }))
  ]
}

export function isFollowing(following: FollowTarget | null, target: FollowTarget): boolean {
  if (!following || following.kind !== target.kind) return false
  return following.kind === 'person'
    ? target.kind === 'person' && following.clientId === target.clientId
    : target.kind === 'agent' && following.agentId === target.agentId
}
