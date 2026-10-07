import { shallowRef, type ShallowRef } from 'vue'

import { AI_ACTIVE_COLOR } from '@open-pencil/core/constants'
import { computeContentBounds } from '@open-pencil/core/io'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { randomHex } from '@open-pencil/scene-graph/random'

import type { RemotePeer } from '@/app/collab/types'
import type { EditorStore } from '@/app/editor/active-store'
import { appPreferences } from '@/app/settings/preferences/store'

import { pickCallsign } from './callsigns'
import { glideViewTo, showCursors, stopViewGlide, type TrackedCursor } from './cursor-motion'
import { MAX_NAME_LENGTH } from './schema'
import type { AgentKind, AgentPresence, FollowTarget, PersonPoint } from './types'

/** Agents' color outside a room, where there is no collaborator color to inherit. */
const SOLO_AGENT_COLOR: Color = { ...AI_ACTIVE_COLOR, a: 1 }

interface Presence {
  /** Agents running in this app for the document. */
  agents: ShallowRef<readonly AgentPresence[]>
  /** People in the room, with their agents. */
  peers: ShallowRef<readonly RemotePeer[]>
  /** The local collaborator's color while in a room. */
  ownerColor: ShallowRef<Color | null>
  /** Who the viewport follows, if anyone. */
  following: ShallowRef<FollowTarget | null>
  /** The page following put the view on; landing anywhere else means you left. */
  followPage: string | null
  /** The page a follow switch is on its way to, so cursor updates do not restart it. */
  switching: string | null
  /** True while following centers the view; any other viewport change is yours. */
  moving: boolean
  /** Our agents the person stopped following mid-work; following them again waits until they rest. */
  declined: Set<string>
}

const presences = new WeakMap<EditorStore, Presence>()

export function presenceOf(store: EditorStore): Presence {
  const existing = presences.get(store)
  if (existing) return existing
  const presence: Presence = {
    agents: shallowRef([]),
    peers: shallowRef([]),
    ownerColor: shallowRef(null),
    following: shallowRef(null),
    followPage: null,
    switching: null,
    moving: false,
    declined: new Set()
  }
  presences.set(store, presence)
  store.onEditorEvent('page:changed', () => {
    stopIfLeftFollowedPage(store)
    refreshCursors(store)
  })
  // Zooming or fitting the view yourself, by any shortcut or menu, ends following. A page
  // switch restores that page's viewport without this event, so only centering is ours.
  store.onEditorEvent('viewport:changed', () => {
    if (presence.following.value && !presence.moving) stopFollowing(store, true)
  })
  return presence
}

function localAgentColor(store: EditorStore): Color {
  return presenceOf(store).ownerColor.value ?? SOLO_AGENT_COLOR
}

/** Someone working on a page, as page lists show them. */
export interface PagePresenceEntry {
  /** Stable per person or agent; names can repeat, such as two people named Anonymous. */
  id: string
  kind: 'person' | 'agent'
  name: string
  color: Color
}

/** The page an agent is working on, or undefined while it is idle. */
export function agentPage(agent: AgentPresence): string | undefined {
  return agent.status === 'idle' ? undefined : (agent.pageId ?? agent.cursor?.pageId)
}

/**
 * People and working agents by page. Reads reactive state, so computed values that call it
 * update as people move and agents start and stop.
 */
export function presenceByPage(store: EditorStore): Map<string, PagePresenceEntry[]> {
  const { agents, peers } = presenceOf(store)
  const byPage = new Map<string, PagePresenceEntry[]>()
  const add = (pageId: string | undefined, entry: PagePresenceEntry) => {
    if (pageId) byPage.set(pageId, [...(byPage.get(pageId) ?? []), entry])
  }
  for (const peer of peers.value) {
    add(peer.cursor?.pageId, {
      id: `person:${peer.clientId}`,
      kind: 'person',
      name: peer.name,
      color: peer.color
    })
    for (const agent of peer.agents)
      add(agentPage(agent), {
        id: `agent:${agent.id}`,
        kind: 'agent',
        name: agent.name,
        color: peer.color
      })
  }
  for (const agent of agents.value) {
    add(agentPage(agent), {
      id: `agent:${agent.id}`,
      kind: 'agent',
      name: agent.name,
      color: localAgentColor(store)
    })
  }
  return byPage
}

function agentCursor(agent: AgentPresence, color: Color, pageId: string): TrackedCursor[] {
  if (agent.status === 'idle' || agent.cursor?.pageId !== pageId) return []
  const { x, y } = agent.cursor
  return [
    {
      id: `agent:${agent.id}`,
      kind: 'agent',
      name: agent.name,
      color,
      x,
      y,
      selection: agent.selection,
      outline: agent.outline
    }
  ]
}

/** Draw everyone working on the page on screen: people, their agents, and ours. */
export function refreshCursors(store: EditorStore): void {
  const { agents, peers } = presenceOf(store)
  const pageId = store.state.currentPageId
  showCursors(store, [
    ...peers.value.flatMap((peer): TrackedCursor[] => [
      ...(peer.cursor?.pageId === pageId
        ? [
            {
              id: `person:${peer.clientId}`,
              kind: 'person' as const,
              name: peer.name,
              color: peer.color,
              ...peer.cursor,
              selection: peer.selection
            }
          ]
        : []),
      ...peer.agents.flatMap((agent) => agentCursor(agent, peer.color, pageId))
    ]),
    ...agents.value.flatMap((agent) => agentCursor(agent, localAgentColor(store), pageId))
  ])
  autoFollow(store)
  keepFollowing(store)
}

/** An agent in a run: following it starts here and waits for its first cursor. */
function isWorking(agent: AgentPresence): boolean {
  return agent.status !== 'idle'
}

/**
 * With Follow agents on, the view follows our agents while they work: whichever starts first
 * when nobody is followed, and the next one at work once the followed agent rests. Following
 * starts with the run, so leaving the page or moving the view while the agent thinks counts as
 * stopping, and an agent the person stopped following is left alone until it rests.
 */
function autoFollow(store: EditorStore): void {
  const presence = presenceOf(store)
  const working = presence.agents.value.filter(isWorking)
  for (const id of presence.declined) {
    if (!working.some((agent) => agent.id === id)) presence.declined.delete(id)
  }
  if (!appPreferences.value.chat.followAgents) return
  const target = presence.following.value
  if (target?.kind === 'person') return
  if (target && working.some((agent) => agent.id === target.agentId)) return
  // A followed agent of someone else's is theirs to stop; only a resting one of ours hands over.
  if (target && !presence.agents.value.some((agent) => agent.id === target.agentId)) return
  const next = working.find((agent) => !presence.declined.has(agent.id))
  if (!next) return
  presence.following.value = { kind: 'agent', agentId: next.id }
  presence.followPage = store.state.currentPageId
}

/** Starts following our agents at work right away, for when Follow agents is turned on. */
export function followWorkingAgents(store: EditorStore): void {
  autoFollow(store)
  keepFollowing(store)
}

/**
 * Where the followed person or agent is: null when they left, idle while an agent rests or a
 * person has not pointed anywhere yet.
 */
function followedPoint(store: EditorStore, target: FollowTarget): PersonPoint | 'idle' | null {
  const { agents, peers } = presenceOf(store)
  if (target.kind === 'person') {
    const peer = peers.value.find((entry) => entry.clientId === target.clientId)
    return peer ? (peer.cursor ?? 'idle') : null
  }
  const agent = [...agents.value, ...peers.value.flatMap((peer) => peer.agents)].find(
    (entry) => entry.id === target.agentId
  )
  if (!agent) return null
  return agent.status === 'idle' ? 'idle' : (agent.cursor ?? 'idle')
}

/** Move the view to the followed person or agent; stop when they are gone. */
function keepFollowing(store: EditorStore): void {
  const presence = presenceOf(store)
  const target = presence.following.value
  if (!target) return
  const point = followedPoint(store, target)
  if (point === 'idle') return
  if (!point) {
    presence.following.value = null
    return
  }
  // A peer's cursor can name a page this document does not have; wait as for a resting agent.
  if (store.graph.getNode(point.pageId)?.type !== 'CANVAS') return
  presence.followPage = point.pageId
  if (point.pageId !== store.state.currentPageId) {
    // Each switch cancels the one before it, so frequent cursor updates must not restart one
    // already heading to this page; when it lands, follow wherever they went meanwhile.
    if (presence.switching === point.pageId) return
    const pageId = point.pageId
    presence.switching = pageId
    void store.switchPage(pageId).finally(() => {
      if (presence.switching === pageId) presence.switching = null
      if (store.state.currentPageId === pageId) keepFollowing(store)
    })
    return
  }
  glideViewTo(store, point, point.zoom ?? store.state.zoom, (x, y, zoom) => {
    // Following ended while the view was on its way: leave it where the person left it.
    if (!presence.following.value) return
    presence.moving = true
    try {
      store.centerOn(x, y, zoom)
    } finally {
      presence.moving = false
    }
  })
}

/** A page change following did not make is yours, so it ends following, even of a resting agent. */
function stopIfLeftFollowedPage(store: EditorStore): void {
  const presence = presenceOf(store)
  if (presence.following.value && store.state.currentPageId !== presence.followPage) {
    declineFollowed(presence)
    presence.following.value = null
  }
}

/** The person stopped following an agent of ours at work: auto-follow leaves it until it rests. */
function declineFollowed(presence: Presence): void {
  const target = presence.following.value
  if (target?.kind !== 'agent') return
  const agent = presence.agents.value.find((entry) => entry.id === target.agentId)
  if (agent && isWorking(agent)) presence.declined.add(agent.id)
}

/** Who the view follows, for showing it: their name, an agent's owner, and the color. */
export interface FollowedLabel {
  kind: FollowTarget['kind']
  name: string
  /** For an agent, the person who runs it; undefined for our own agents. */
  owner?: string
  color: Color
}

export function followedLabel(store: EditorStore): FollowedLabel | null {
  const { agents, peers, ownerColor, following } = presenceOf(store)
  const target = following.value
  if (!target) return null
  if (target.kind === 'person') {
    const peer = peers.value.find((entry) => entry.clientId === target.clientId)
    return peer ? { kind: 'person', name: peer.name, color: peer.color } : null
  }
  const own = agents.value.find((agent) => agent.id === target.agentId)
  if (own) return { kind: 'agent', name: own.name, color: ownerColor.value ?? SOLO_AGENT_COLOR }
  for (const peer of peers.value) {
    const agent = peer.agents.find((entry) => entry.id === target.agentId)
    if (agent) return { kind: 'agent', name: agent.name, owner: peer.name, color: peer.color }
  }
  return null
}

/** Stop following; a follow switch still loading is overtaken, so it does not land later. */
function stopFollowing(store: EditorStore, byPerson: boolean): void {
  const presence = presenceOf(store)
  if (byPerson) declineFollowed(presence)
  presence.following.value = null
  stopViewGlide(store)
  if (presence.switching) {
    presence.switching = null
    void store.switchPage(store.state.currentPageId)
  }
}

/** Follow a person or an agent, or stop following with null. */
export function follow(store: EditorStore, target: FollowTarget | null): void {
  if (!target) {
    stopFollowing(store, true)
    return
  }
  const presence = presenceOf(store)
  presence.following.value = target
  presence.followPage = store.state.currentPageId
  keepFollowing(store)
}

/** Rename one of our agents; the new name reaches the room with our next awareness update. */
export function renameAgent(store: EditorStore, agentId: string, name: string): void {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  const presence = presenceOf(store)
  if (!trimmed) return
  presence.agents.value = presence.agents.value.map((agent) =>
    agent.id === agentId ? { ...agent, name: trimmed } : agent
  )
  refreshCursors(store)
}

export function setPeers(store: EditorStore, peers: readonly RemotePeer[]): void {
  presenceOf(store).peers.value = peers
  refreshCursors(store)
}

export function setOwnerColor(store: EditorStore, color: Color | null): void {
  presenceOf(store).ownerColor.value = color
  refreshCursors(store)
}

export interface AgentHandle {
  readonly id: string
  readonly name: string
  update: (patch: Partial<Omit<AgentPresence, 'id' | 'name' | 'kind'>>) => void
  remove: () => void
}

/** Announce an agent working in this document under a callsign unique among visible agents. */
export function addAgent(store: EditorStore, kind: AgentKind, model?: string): AgentHandle {
  const presence = presenceOf(store)
  const taken = new Set([
    ...presence.agents.value.map((agent) => agent.name),
    ...presence.peers.value.flatMap((peer) => peer.agents.map((agent) => agent.name))
  ])
  const agent: AgentPresence = {
    id: randomHex(8),
    name: pickCallsign(taken),
    kind,
    model,
    status: 'idle'
  }
  presence.agents.value = [...presence.agents.value, agent]
  const current = () => presence.agents.value.find((entry) => entry.id === agent.id)
  const replace = (next: AgentPresence | null) => {
    const agents = presence.agents.value
    presence.agents.value = next
      ? agents.map((entry) => (entry.id === agent.id ? next : entry))
      : agents.filter((entry) => entry.id !== agent.id)
    refreshCursors(store)
  }
  return {
    id: agent.id,
    // The owner may rename the agent.
    get name() {
      return current()?.name ?? agent.name
    },
    update: (patch) => {
      const entry = current()
      if (entry) replace({ ...entry, ...patch })
    },
    remove: () => replace(null)
  }
}

/**
 * Where an agent shows it is working on `nodeIds`: its cursor at their top-left corner on
 * `pageId`, and their outlines. Null when none of them is in the document.
 */
export function agentPlacement(
  store: EditorStore,
  nodeIds: readonly string[],
  pageId: string
): Pick<AgentPresence, 'cursor' | 'selection' | 'outline'> | null {
  const present = nodeIds.filter((id) => store.graph.getNode(id))
  const bounds = computeContentBounds(store.graph, present)
  if (!bounds) return null
  return {
    cursor: { x: bounds.minX, y: bounds.minY, pageId },
    selection: present,
    outline: undefined
  }
}
