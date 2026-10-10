import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { PagePoint } from '@/app/editor/pages/point'

export const AGENT_KINDS = ['chat', 'acp', 'harness', 'mcp'] as const
export type AgentKind = (typeof AGENT_KINDS)[number]

export const AGENT_STATUSES = ['thinking', 'editing', 'idle'] as const
export type AgentStatus = (typeof AGENT_STATUSES)[number]

/** A person's pointer, with the zoom they view it at so followers can match it. */
export interface PersonPoint extends PagePoint {
  zoom?: number
}

/** Who to keep in view: a person in the room, or any agent, ours or theirs. */
export type FollowTarget = { kind: 'person'; clientId: number } | { kind: 'agent'; agentId: string }

/**
 * An agent as its owner publishes it: metadata only, never prompts or tool arguments. What its
 * streamed `render` call builds travels apart from presence (`./preview-stream.ts`).
 */
export interface AgentPresence {
  id: string
  /** A callsign, unique among the agents in a room, such as "Fern". */
  name: string
  kind: AgentKind
  model?: string
  status: AgentStatus
  /** The page the agent works on, known before its first edit. */
  pageId?: string
  /** Where the agent last worked, derived from the nodes it touched. */
  cursor?: PagePoint
  selection?: string[]
  /** Outlines, in world coordinates on the cursor's page, of what is not a layer yet. */
  outline?: Rect[]
}
