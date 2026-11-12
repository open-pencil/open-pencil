import * as v from 'valibot'

import { isUnknownRecord } from '@/app/automation/bridge/target'
import type { EditorStore } from '@/app/editor/active-store'
import { addAgent, agentPlacement, type AgentHandle } from '@/app/presence/registry'
import { MAX_NAME_LENGTH } from '@/app/presence/schema'
import { createDeferred } from '@/app/runtime/deferred'

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
  ),
  /** The app chat whose agent made the call, and the call's id in that chat. */
  chat: v.fallback(v.optional(v.pipe(v.string(), v.regex(/^[0-9a-f]{16,64}$/))), undefined),
  call: v.fallback(v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))), undefined)
})

/**
 * The MCP session a tool call came from, as the MCP server forwards it, and for a call made by a
 * subagent of an app chat's agent, that subagent (`withSubagent`).
 */
export type AgentSession = v.InferOutput<typeof agentSessionSchema> & {
  /** The Agent call of the subagent that made the call; the MCP server never sends it. */
  subagent?: string
}

export function readAgentSession(value: unknown): AgentSession | null {
  const result = v.safeParse(agentSessionSchema, value)
  return result.success ? result.output : null
}

interface SessionAgent {
  session: string
  store: EditorStore
  /** The Agent call of the subagent this agent shows, or undefined for the session's own agent. */
  subagent: string | undefined
  handle: AgentHandle
  kind: AgentSession['kind']
  /** Counts the times its chat's replies ended; a tool call from an earlier reply is ignored. */
  replies: number
  idleTimer?: ReturnType<typeof setTimeout>
  goneTimer?: ReturnType<typeof setTimeout>
}

/**
 * Each session's agents: its own in every document it works in, and one for each of its
 * subagents in every document they work in; tool calls name their document.
 */
const sessionAgents = new Set<SessionAgent>()

/** For each app chat, the Agent call of the subagent that made each tool call its agent reported. */
const subagentCalls = new Map<string, Map<string, string>>()

function findAgent(store: EditorStore, session: AgentSession): SessionAgent | undefined {
  for (const agent of sessionAgents) {
    if (
      agent.session === session.session &&
      agent.store === store &&
      agent.subagent === session.subagent
    ) {
      return agent
    }
  }
  return undefined
}

function sessionAgent(store: EditorStore, session: AgentSession): SessionAgent {
  let agent = findAgent(store, session)
  if (!agent) {
    agent = {
      session: session.session,
      store,
      subagent: session.subagent,
      handle: addAgent(store, session.kind, session.client || undefined),
      kind: session.kind,
      replies: 0
    }
    sessionAgents.add(agent)
  }
  return agent
}

function remove(agent: SessionAgent): void {
  clearTimeout(agent.idleTimer)
  clearTimeout(agent.goneTimer)
  agent.handle.remove()
  sessionAgents.delete(agent)
}

function rest(agent: SessionAgent): void {
  agent.handle.update({ status: 'idle', cursor: undefined, selection: undefined })
}

/** A subagent is done: its agent rests, so following moves on to one still at work, and leaves. */
function leave(agent: SessionAgent): void {
  rest(agent)
  remove(agent)
}

function restartTimers(agent: SessionAgent): void {
  clearTimeout(agent.idleTimer)
  clearTimeout(agent.goneTimer)
  agent.idleTimer = setTimeout(() => rest(agent), MCP_AGENT_IDLE_MS)
  agent.goneTimer = setTimeout(() => remove(agent), MCP_AGENT_GONE_MS)
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

/**
 * A session started a tool call on `pageId`: its agent shows it is at work there. Returns the
 * reply the call belongs to, for `agentFinished`.
 */
export function agentStarted(store: EditorStore, session: AgentSession, pageId: string): number {
  const agent = sessionAgent(store, session)
  agent.handle.update({ status: 'thinking', pageId })
  restartTimers(agent)
  return agent.replies
}

/**
 * A session's tool call finished: its agent points at the layers the call read or changed, so
 * people see the context it works with, and edits show as editing.
 */
export function agentFinished(
  store: EditorStore,
  session: AgentSession,
  work: { pageId: string; nodeIds: readonly string[]; edited: boolean; reply: number }
): void {
  const agent = findAgent(store, session)
  // A call that was running when its chat's reply ended lands without bringing the agent back
  // or moving it away from what a later reply works on, and one whose subagent finished has no
  // agent left to show it.
  if (!agent || work.reply !== agent.replies) return
  const placement = agentPlacement(store, work.nodeIds, work.pageId)
  agent.handle.update({
    status: work.edited ? 'editing' : 'thinking',
    pageId: work.pageId,
    ...placement
  })
  restartTimers(agent)
}

/**
 * The app's own ACP or Pi chat ended a reply, finished, stopped, or failed: that chat's agent
 * rests now rather than when its idle timer runs out, and its subagents leave. Only the app's
 * chats send these kinds (`src/app/integrations/mcp`), so no outside MCP client is touched.
 */
export function restAgents(kind: Exclude<AgentSession['kind'], 'mcp'>): void {
  for (const agent of sessionAgents) {
    if (agent.kind !== kind) continue
    if (agent.subagent) {
      leave(agent)
      continue
    }
    clearTimeout(agent.idleTimer)
    agent.replies++
    rest(agent)
  }
  // What the reply's updates said about its subagents ends with it.
  if (kind === 'acp') subagentCalls.clear()
}

/**
 * An app chat's agent reported a tool call over ACP: the Agent call of the subagent that made it,
 * if one did, and whether it ended (`src/app/ai/agents/acp/subagents.ts`). An ended call is
 * forgotten, and when it is a subagent's Agent call, that subagent is done and its agent leaves.
 */
export function noteToolCall(
  chat: string,
  call: { id: string; subagent?: string; ended: boolean }
): void {
  if (call.ended) {
    subagentCalls.get(chat)?.delete(call.id)
    for (const agent of sessionAgents) if (agent.subagent === call.id) leave(agent)
  } else if (call.subagent) {
    const calls = subagentCalls.get(chat) ?? new Map<string, string>()
    calls.set(call.id, call.subagent)
    subagentCalls.set(chat, calls)
  }
}

/**
 * `session` with the subagent that made its call, when its chat's ACP updates already named it.
 * A call that reaches OpenPencil before its update stays with the session's own agent: a tool
 * call never waits for the update.
 */
export function withSubagent(session: AgentSession): AgentSession {
  const subagent =
    session.chat && session.call ? subagentCalls.get(session.chat)?.get(session.call) : undefined
  return subagent ? { ...session, subagent } : session
}

/** App chats waiting for their agent to open its MCP session, by chat id. */
const waitingChats = new Map<string, () => void>()

/**
 * Waits for the agent of the app chat `chat` to open its MCP session, which the server reports
 * when the agent's initialize succeeds. Start watching before the agent starts its session.
 */
export function watchChatAgent(chat: string): { connected: Promise<void>; stop: () => void } {
  const deferred = createDeferred<undefined>()
  waitingChats.set(chat, () => deferred.resolve(undefined))
  return { connected: deferred.promise, stop: () => waitingChats.delete(chat) }
}

/** The MCP server says an agent opened a session; the ACP chat waiting for it may go on. */
export function agentSessionOpened(args: unknown): void {
  if (!isUnknownRecord(args) || args.kind !== 'acp') return
  const { chat } = args
  if (typeof chat !== 'string') return
  waitingChats.get(chat)?.()
  waitingChats.delete(chat)
}

/** The MCP server says a session ended: its agents leave every document. */
export function endAgentSession(sessionId: string): void {
  // Removing entries while iterating a Set is safe: visited ones stay visited.
  for (const agent of sessionAgents) if (agent.session === sessionId) remove(agent)
}
