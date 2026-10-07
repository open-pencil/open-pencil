import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { agentStarted, endAgentSession, type AgentSession } from '@/app/automation/agents'
import { connectAutomation } from '@/app/automation/bridge/server'
import { createEditorStore, type EditorStore } from '@/app/editor/session'
import { presenceOf } from '@/app/presence/registry'

import { expectDefined } from '#tests/helpers/assert'
import { asDouble } from '#tests/helpers/doubles'

const claude: AgentSession = { session: 'bridge-session', kind: 'mcp', client: 'claude-code' }

/** A browser socket: closing it reports the close later, as the WebSocket close handshake does. */
class FakeSocket {
  static readonly OPEN = 1
  static opened: FakeSocket[] = []
  readyState = FakeSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => Promise<void>) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  readonly sent: string[] = []

  constructor() {
    FakeSocket.opened.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 2
  }

  /** Reports the close the bridge asked for. */
  closed() {
    this.readyState = 3
    this.onclose?.({ code: 1000, reason: '' })
  }

  /** Delivers a tool call from the agent's MCP session. */
  async request(id: string) {
    await this.onmessage?.({
      data: JSON.stringify({ type: 'request', id, command: 'unknown', args: { agent: claude } })
    })
  }
}

const RealWebSocket = globalThis.WebSocket
let store: EditorStore

beforeEach(() => {
  FakeSocket.opened = []
  globalThis.WebSocket = asDouble<typeof WebSocket>(FakeSocket)
  store = createEditorStore(new SceneGraph())
})

afterEach(() => {
  endAgentSession(claude.session)
  store.preparationController.dispose()
  globalThis.WebSocket = RealWebSocket
})

function agents() {
  return presenceOf(store).agents.value
}

function openBridge() {
  const bridge = connectAutomation(() => store, 'token', 'ws://automation.test')
  return { bridge, socket: expectDefined(FakeSocket.opened.at(-1), 'socket') }
}

describe('automation bridge sessions', () => {
  test('restarting MCP keeps the agent of a session the new connection carries', async () => {
    agentStarted(store, claude, expectDefined(store.graph.getPages()[0], 'page').id)
    const old = openBridge()
    await old.socket.request('1')

    old.bridge.disconnect()
    const restarted = openBridge()
    await restarted.socket.request('2')
    old.socket.closed()
    expect(agents()).toHaveLength(1)

    restarted.bridge.disconnect()
    restarted.socket.closed()
    expect(agents()).toHaveLength(0)
  })

  test('a session that only an old connection carried ends with it', async () => {
    agentStarted(store, claude, expectDefined(store.graph.getPages()[0], 'page').id)
    const old = openBridge()
    await old.socket.request('1')

    old.bridge.disconnect()
    openBridge()
    old.socket.closed()
    expect(agents()).toHaveLength(0)
  })
})
