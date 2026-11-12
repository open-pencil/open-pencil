import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  MCP_AGENT_GONE_MS,
  MCP_AGENT_IDLE_MS,
  agentFinished,
  agentSessionOpened,
  agentStarted,
  endAgentSession,
  noteToolCall,
  readAgentSession,
  restAgents,
  touchedNodeIds,
  withSubagent,
  type AgentSession,
  watchChatAgent
} from '@/app/automation/agents'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { presenceOf } from '@/app/presence/registry'
const claude: AgentSession = { session: 'session-1', kind: 'mcp', client: 'claude-code' }
const pi: AgentSession = { session: 'session-pi', kind: 'harness', client: 'pi' }

let store: EditorStore

beforeEach(() => {
  jest.useFakeTimers()
  store = createEditorStore(new SceneGraph())
})

afterEach(() => {
  endAgentSession(claude.session)
  endAgentSession(pi.session)
  store.preparationController.dispose()
  jest.useRealTimers()
})

function pageId() {
  return expectDefined(store.graph.getPages()[0], 'page').id
}

function agents() {
  return presenceOf(store).agents.value
}

describe('MCP sessions as agents', () => {
  test('a session shows as one agent, named by its client, while its tools run', () => {
    agentStarted(store, claude, pageId())
    agentStarted(store, claude, pageId())
    expect(agents()).toHaveLength(1)
    expect(agents()[0]).toMatchObject({ kind: 'mcp', model: 'claude-code', status: 'thinking' })
  })

  test('the agent points at what a call reads and what it edits', () => {
    const card = store.graph.createNode('FRAME', pageId(), { x: 40, y: 60, width: 100, height: 80 })
    const reply = agentStarted(store, claude, pageId())
    agentFinished(store, claude, {
      pageId: pageId(),
      nodeIds: touchedNodeIds(store, { id: card.id }, { name: 'Card' }),
      edited: false,
      reply
    })
    expect(agents()[0]).toMatchObject({
      status: 'thinking',
      cursor: { x: 40, y: 60, pageId: pageId() },
      selection: [card.id]
    })

    const made = store.graph.createNode('RECTANGLE', pageId(), { x: 200, y: 10 })
    agentFinished(store, claude, {
      pageId: pageId(),
      nodeIds: touchedNodeIds(store, {}, { results: [{ id: made.id }] }),
      edited: true,
      reply
    })
    expect(agents()[0]).toMatchObject({ status: 'editing', selection: [made.id] })
  })

  test('the agent works on the page of the layers it touched', () => {
    const other = store.graph.addPage('Other')
    const node = store.graph.createNode('RECTANGLE', other.id, {})
    const reply = agentStarted(store, claude, pageId())
    agentFinished(store, claude, { pageId: pageId(), nodeIds: [node.id], edited: true, reply })
    expect(agents()[0]).toMatchObject({ pageId: other.id, cursor: { pageId: other.id } })
  })

  test('pages and the document are not layers a call works on', () => {
    const node = store.graph.createNode('RECTANGLE', pageId(), {})
    expect(
      touchedNodeIds(store, { ids: [pageId(), store.graph.rootId, node.id, 'missing'] }, null)
    ).toEqual([node.id])
  })

  test('a quiet session rests, and one that never says goodbye leaves', () => {
    agentStarted(store, claude, pageId())
    jest.advanceTimersByTime(MCP_AGENT_IDLE_MS)
    expect(agents()[0]).toMatchObject({ status: 'idle', cursor: undefined })
    jest.advanceTimersByTime(MCP_AGENT_GONE_MS)
    expect(agents()).toEqual([])
  })

  test('a session that ends takes its agents out of every document', () => {
    const second = createEditorStore(new SceneGraph())
    try {
      agentStarted(store, claude, pageId())
      agentStarted(second, claude, expectDefined(second.graph.getPages()[0], 'page').id)
      endAgentSession(claude.session)
      expect(agents()).toEqual([])
      expect(presenceOf(second).agents.value).toEqual([])
    } finally {
      second.preparationController.dispose()
    }
  })

  test('ACP and harness chats show as their own kinds, and a forwarded session is validated', () => {
    expect(readAgentSession({ session: 'a', kind: 'acp' })).toMatchObject({ kind: 'acp' })
    expect(readAgentSession({ session: 'a', kind: 'harness', client: 'pi' })).toMatchObject({
      kind: 'harness',
      client: 'pi'
    })
    expect(readAgentSession({ session: '', kind: 'mcp' })).toBeNull()
    expect(readAgentSession({ session: 'a', kind: 'chat' })).toBeNull()
    expect(readAgentSession(undefined)).toBeNull()
  })
})

describe("the app's own ACP and Pi chats", () => {
  const status = (session: AgentSession) =>
    agents().find((agent) => agent.kind === session.kind)?.status

  test("when a chat's reply ends, its agent rests at once and outside clients keep working", () => {
    agentStarted(store, pi, pageId())
    agentStarted(store, claude, pageId())

    restAgents('harness')

    expect(status(pi)).toBe('idle')
    expect(status(claude)).toBe('thinking')
  })

  test('a call that was running when the reply ended does not bring the agent back', () => {
    const card = store.graph.createNode('FRAME', pageId(), {})
    const late = agentStarted(store, pi, pageId())
    restAgents('harness')

    agentFinished(store, pi, { pageId: pageId(), nodeIds: [card.id], edited: true, reply: late })
    expect(status(pi)).toBe('idle')

    // The chat's next reply calls a tool, and the earlier call landing then leaves it be.
    const next = agentStarted(store, pi, pageId())
    agentFinished(store, pi, { pageId: pageId(), nodeIds: [card.id], edited: true, reply: late })
    expect(status(pi)).toBe('thinking')
    agentFinished(store, pi, { pageId: pageId(), nodeIds: [card.id], edited: true, reply: next })
    expect(status(pi)).toBe('editing')
  })
})

describe("a chat's agent reaching OpenPencil's tools", () => {
  test('the chat goes on once the server says its own agent opened a session', async () => {
    const watch = watchChatAgent('0123456789abcdef')
    let connected = false
    void watch.connected.then(() => (connected = true))

    agentSessionOpened({ session: 's-1', kind: 'acp', chat: 'fedcba9876543210' })
    agentSessionOpened({ session: 's-2', kind: 'mcp' })
    // An outside MCP client naming the chat does not stand in for its ACP agent.
    agentSessionOpened({ session: 's-4', kind: 'mcp', chat: '0123456789abcdef' })
    await Promise.resolve()
    expect(connected).toBe(false)

    agentSessionOpened({ session: 's-3', kind: 'acp', chat: '0123456789abcdef' })
    await watch.connected
    expect(connected).toBe(true)
  })

  test('a chat that stopped waiting ignores a late session', async () => {
    const watch = watchChatAgent('00112233445566778899')
    watch.stop()
    agentSessionOpened({ session: 's-1', kind: 'acp', chat: '00112233445566778899' })
    const settled = await Promise.race([
      watch.connected.then(() => 'connected'),
      Promise.resolve('waiting')
    ])
    expect(settled).toBe('waiting')
  })
})

describe("a coding agent's subagents", () => {
  const CHAT = '0123456789abcdef'
  const OTHER_CHAT = 'fedcba9876543210'
  const acp: AgentSession = {
    session: 'session-acp',
    kind: 'acp',
    client: 'claude-code',
    chat: CHAT
  }
  const otherACP: AgentSession = { ...acp, session: 'session-acp-2', chat: OTHER_CHAT }
  let layers = 0

  afterEach(() => {
    endAgentSession(acp.session)
    endAgentSession(otherACP.session)
    restAgents('acp')
  })

  /** The chat's agent reported tool call `call`, made by the subagent of its Agent call `subagent`. */
  function reported(call: string, subagent?: string) {
    noteToolCall(CHAT, { id: call, subagent, ended: false })
  }

  /** The agent's call `call` works on a new layer; returns the agent that shows it there. */
  function work(call: string, from = acp) {
    const node = store.graph.createNode('RECTANGLE', pageId(), { x: 100 * layers++, y: 0 })
    const session = withSubagent({ ...from, call })
    const reply = agentStarted(store, session, pageId())
    agentFinished(store, session, { pageId: pageId(), nodeIds: [node.id], edited: true, reply })
    return expectDefined(
      agents().find((agent) => agent.selection?.includes(node.id)),
      'the agent that worked on the layer'
    )
  }

  test("a call of the chat's own agent stays with its agent, and a subagent keeps its agent", () => {
    reported('toolu_a1', 'toolu_task_a')
    reported('toolu_a2', 'toolu_task_a')
    const first = work('toolu_a1')
    const own = work('toolu_own')
    const ownAgain = work('toolu_own_2')
    const firstAgain = work('toolu_a2')

    expect(agents()).toHaveLength(2)
    expect(ownAgain.id).toBe(own.id)
    expect(firstAgain.id).toBe(first.id)
  })

  test('a call is a subagent’s only in the chat whose agent reported it', () => {
    noteToolCall('fedcba9876543210', { id: 'toolu_a1', subagent: 'toolu_task_a', ended: false })
    work('toolu_a1')
    expect(agents()).toHaveLength(1)
  })

  test('a subagent leaves when its Agent call finishes, and the others carry on', () => {
    reported('toolu_a1', 'toolu_task_a')
    reported('toolu_b1', 'toolu_task_b')
    const own = work('toolu_own')
    work('toolu_a1')
    const staying = work('toolu_b1')

    noteToolCall(CHAT, { id: 'toolu_task_a', ended: true })

    expect(agents().map((agent) => agent.id)).toEqual([own.id, staying.id])
  })

  test('a call still running when its subagent finished does not bring the agent back', () => {
    reported('toolu_a1', 'toolu_task_a')
    const session = withSubagent({ ...acp, call: 'toolu_a1' })
    const reply = agentStarted(store, session, pageId())
    noteToolCall(CHAT, { id: 'toolu_task_a', ended: true })

    const node = store.graph.createNode('RECTANGLE', pageId(), {})
    agentFinished(store, session, { pageId: pageId(), nodeIds: [node.id], edited: true, reply })

    expect(agents()).toEqual([])
  })

  test('the view moves on to another agent at work when the followed subagent finishes', () => {
    reported('toolu_a1', 'toolu_task_a')
    reported('toolu_b1', 'toolu_task_b')
    const followed = work('toolu_a1')
    const other = work('toolu_b1')
    expect(presenceOf(store).following.value).toEqual({ kind: 'agent', agentId: followed.id })

    noteToolCall(CHAT, { id: 'toolu_task_a', ended: true })

    expect(presenceOf(store).following.value).toEqual({ kind: 'agent', agentId: other.id })
  })

  test('a call that runs before its update arrives belongs to the chat’s own agent', () => {
    const card = store.graph.createNode('FRAME', pageId(), { x: 5, y: 5 })
    const session = withSubagent({ ...acp, call: 'toolu_a1' })
    const reply = agentStarted(store, session, pageId())
    // The update that names its subagent lands while the call runs.
    reported('toolu_a1', 'toolu_task_a')
    agentFinished(store, session, { pageId: pageId(), nodeIds: [card.id], edited: true, reply })

    expect(agents()).toHaveLength(1)
    expect(agents()[0]).toMatchObject({ status: 'editing', selection: [card.id] })

    // The subagent's next call shows as the subagent.
    reported('toolu_a2', 'toolu_task_a')
    work('toolu_a2')
    expect(agents()).toHaveLength(2)
  })

  test('when the chat’s reply ends, its subagents leave and its own agent rests', () => {
    reported('toolu_a1', 'toolu_task_a')
    const own = work('toolu_own')
    work('toolu_a1')

    restAgents('acp', CHAT)

    expect(agents().map(({ id, status }) => ({ id, status }))).toEqual([
      { id: own.id, status: 'idle' }
    ])
    // What the reply's updates said about its subagents is not carried into the next reply.
    work('toolu_a1')
    expect(agents()).toHaveLength(1)
  })

  test('one chat’s reply ending leaves another chat’s agents and subagents at work', () => {
    reported('toolu_a1', 'toolu_task_a')
    noteToolCall(OTHER_CHAT, { id: 'toolu_b1', subagent: 'toolu_task_b', ended: false })
    work('toolu_a1')
    const otherOwn = work('toolu_own', otherACP)
    const otherSub = work('toolu_b1', otherACP)
    // A call of the other chat is still running when this chat's reply ends.
    const running = withSubagent({ ...otherACP, call: 'toolu_b1' })
    const reply = agentStarted(store, running, pageId())

    restAgents('acp', CHAT)

    expect(agents().map(({ id }) => id)).toEqual([otherOwn.id, otherSub.id])
    expect(agents().find((agent) => agent.id === otherOwn.id)?.status).toBe('editing')
    expect(withSubagent({ ...otherACP, call: 'toolu_b1' }).subagent).toBe('toolu_task_b')
    const node = store.graph.createNode('RECTANGLE', pageId(), {})
    agentFinished(store, running, { pageId: pageId(), nodeIds: [node.id], edited: true, reply })
    expect(agents().find((agent) => agent.id === otherSub.id)).toMatchObject({
      status: 'editing',
      selection: [node.id]
    })
  })

  test('a finished Agent call takes the calls made inside it along', () => {
    reported('toolu_a1', 'toolu_task_a')
    work('toolu_a1')
    noteToolCall(CHAT, { id: 'toolu_task_a', ended: true })
    expect(agents()).toEqual([])

    // An inner call that reaches OpenPencil after its Agent call ended is the chat's own agent's.
    expect(withSubagent({ ...acp, call: 'toolu_a1' }).subagent).toBeUndefined()
    work('toolu_a1')
    expect(agents()).toHaveLength(1)
  })

  test('a session that ends takes its subagents with it', () => {
    reported('toolu_a1', 'toolu_task_a')
    work('toolu_own')
    work('toolu_a1')
    endAgentSession(acp.session)
    expect(agents()).toEqual([])
  })
})
