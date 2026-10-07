import * as v from 'valibot'

import { isUnknownRecord } from '@/app/automation/bridge/target'
import type { EditorStore } from '@/app/editor/active-store'
import { addAgent, agentPlacement, type AgentHandle } from '@/app/presence/registry'
import { MAX_NAME_LENGTH } from '@/app/presence/schema'

/** After this long without a tool call, a session's agent rests and leaves the canvas. */
export const MCP_AGENT_IDLE_MS = 20_000
/** A session that never says goodbye, such as one whose client crashed, is dropped after this. */
export const MCP_AGENT_GONE_MS = 10 * 60_000
const MAX_SESSION_ID = 128
/** Argument and result fields that name the layers a tool works on. */
const NODE_ID_FIELDS = ['id', 'ids', 'node_id', 'node_ids', 'parent_id', 'root_id', 'target_id']
const NODE_LIST_FIELDS = ['results', 'selection', 'nodes']

const agentSessionSchema = v.object({
  session: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_SESSION_ID)),
  kind: v.picklist(['mcp', 'acp', 'harness']),
  client: v.fallback(
    v.optional(v.pipe(v.string(), v.trim(), v.maxLength(MAX_NAME_LENGTH))),
    undefined
  )
})

/** The MCP session a tool call came from, as the MCP server forwards it. */
export type AgentSession = v.InferOutput<typeof agentSessionSchema>

export function readAgentSession(value: unknown): AgentSession | null {
  const result = v.safeParse(agentSessionSchema, value)
  return result.success ? result.output : null
}

interface SessionAgent {
  handle: AgentHandle
  idleTimer?: ReturnType<typeof setTimeout>
  goneTimer?: ReturnType<typeof setTimeout>
}

/** Each session's agent in every document it works in; tool calls name their document. */
const sessions = new Map<string, Map<EditorStore, SessionAgent>>()

function sessionAgent(store: EditorStore, session: AgentSession): SessionAgent {
  let agents = sessions.get(session.session)
  if (!agents) {
    agents = new Map()
    sessions.set(session.session, agents)
  }
  let agent = agents.get(store)
  if (!agent) {
    agent = { handle: addAgent(store, session.kind, session.client || undefined) }
    agents.set(store, agent)
  }
  return agent
}

function remove(sessionId: string, store: EditorStore): void {
  const agents = sessions.get(sessionId)
  const agent = agents?.get(store)
  if (!agents || !agent) return
  clearTimeout(agent.idleTimer)
  clearTimeout(agent.goneTimer)
  agent.handle.remove()
  agents.delete(store)
  if (agents.size === 0) sessions.delete(sessionId)
}

function restartTimers(store: EditorStore, sessionId: string, agent: SessionAgent): void {
  clearTimeout(agent.idleTimer)
  clearTimeout(agent.goneTimer)
  agent.idleTimer = setTimeout(() => {
    agent.handle.update({ status: 'idle', cursor: undefined, selection: undefined })
  }, MCP_AGENT_IDLE_MS)
  agent.goneTimer = setTimeout(() => remove(sessionId, store), MCP_AGENT_GONE_MS)
}

function collectIds(value: unknown, ids: Set<string>): void {
  if (!isUnknownRecord(value)) return
  const record = value
  for (const field of NODE_ID_FIELDS) {
    const entry = record[field]
    if (typeof entry === 'string') ids.add(entry)
    else if (Array.isArray(entry)) {
      for (const item of entry) if (typeof item === 'string') ids.add(item)
    }
  }
  for (const field of NODE_LIST_FIELDS) {
    const list = record[field]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (isUnknownRecord(item) && typeof item.id === 'string') ids.add(item.id)
    }
  }
}

/** The layers a tool call works on: what its arguments name, then what its result names. */
export function touchedNodeIds(store: EditorStore, args: unknown, result: unknown): string[] {
  const ids = new Set<string>()
  collectIds(args, ids)
  collectIds(result, ids)
  return [...ids].filter((id) => {
    const node = store.graph.getNode(id)
    // Pages and the document root are where the agent is, not what it works on.
    return node !== undefined && node.type !== 'CANVAS' && id !== store.graph.rootId
  })
}

function pageOf(store: EditorStore, nodeId: string): string | undefined {
  let node = store.graph.getNode(nodeId)
  while (node && node.type !== 'CANVAS')
    node = node.parentId ? store.graph.getNode(node.parentId) : undefined
  return node?.id
}

/** A session started a tool call on `pageId`: its agent shows it is at work there. */
export function agentStarted(store: EditorStore, session: AgentSession, pageId: string): void {
  const agent = sessionAgent(store, session)
  agent.handle.update({ status: 'thinking', pageId })
  restartTimers(store, session.session, agent)
}

/**
 * A session's tool call finished: its agent points at the layers the call read or changed, so
 * people see the context it works with, and edits show as editing.
 */
export function agentFinished(
  store: EditorStore,
  session: AgentSession,
  work: { pageId: string; nodeIds: readonly string[]; edited: boolean }
): void {
  const agent = sessionAgent(store, session)
  const first = work.nodeIds[0]
  const pageId = (first && pageOf(store, first)) || work.pageId
  const placement = agentPlacement(store, work.nodeIds, pageId)
  agent.handle.update({
    status: work.edited ? 'editing' : 'thinking',
    pageId,
    ...placement
  })
  restartTimers(store, session.session, agent)
}

/** The MCP server says a session ended: its agents leave every document. */
export function endAgentSession(sessionId: string): void {
  // Removing entries while iterating a Map is safe: visited ones stay visited.
  for (const store of sessions.get(sessionId)?.keys() ?? []) remove(sessionId, store)
}
