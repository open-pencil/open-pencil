import type { Color } from '@open-pencil/scene-graph/primitives'

import type { RemotePeer } from '@/app/collab/types'
import { agentPage } from '@/app/presence/registry'
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

/**
 * The people on one page, each with only the agents they run there: collaborators whose cursor is
 * on it, and anyone, you included, whose agents work there.
 */
export function pagePresenceRows(
  self: { name: string; color: Color; agents: readonly AgentPresence[] },
  peers: readonly RemotePeer[],
  pageId: string
): PresencePersonRow[] {
  const onPage = (agents: readonly AgentPresence[]) =>
    agentRows(
      agents.filter((agent) => agentPage(agent) === pageId),
      () => undefined,
      false
    )
  const rows: PresencePersonRow[] = []
  const ownAgents = onPage(self.agents)
  if (ownAgents.length > 0) rows.push({ name: self.name, color: self.color, agents: ownAgents })
  for (const peer of peers) {
    const agents = onPage(peer.agents)
    if (peer.cursor?.pageId !== pageId && agents.length === 0) continue
    rows.push({ clientId: peer.clientId, name: peer.name, color: peer.color, agents })
  }
  return rows
}

export function isFollowing(following: FollowTarget | null, target: FollowTarget): boolean {
  if (!following || following.kind !== target.kind) return false
  return following.kind === 'person'
    ? target.kind === 'person' && following.clientId === target.clientId
    : target.kind === 'agent' && following.agentId === target.agentId
}
