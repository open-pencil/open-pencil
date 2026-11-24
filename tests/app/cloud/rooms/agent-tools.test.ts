import { describe, expect, test } from 'bun:test'

import {
  decodeAgentToolMessage,
  encodeAgentToolMessage,
  RELAY_SERVER_PEER,
  type AgentToolCall,
  type AgentToolMessage
} from '@open-pencil/cloud/contract'
import { asDouble } from '@open-pencil/test-support/doubles'

import { serveRoomAgentTools, type RunAgentTool } from '@/app/cloud/rooms/agent-tools'
import type { CollabActionReceiver } from '@/app/collab/transport/types'
import type { EditorStore } from '@/app/editor/session'

const agent = { session: 'app:claude', client: 'Claude' }
const store = asDouble<EditorStore>({})

/** A tab's tool channel, with what it sent and a way to deliver what peers send it. */
function channel() {
  const sent: { message: AgentToolMessage | null; target: string | undefined }[] = []
  let receiver: CollabActionReceiver | undefined
  let joined: ((peerId: string) => void) | undefined
  return {
    sent,
    action: [
      (data: Uint8Array, target?: string) => {
        sent.push({ message: decodeAgentToolMessage(data), target })
      },
      (handler: CollabActionReceiver) => {
        receiver = handler
      }
    ] as const,
    onPeerJoin(handler: (peerId: string) => void) {
      joined = handler
      return () => {
        joined = undefined
      }
    },
    deliver(message: AgentToolMessage, from = RELAY_SERVER_PEER) {
      receiver?.(encodeAgentToolMessage(message), from)
    },
    join(peerId: string) {
      joined?.(peerId)
    },
    results: () => sent.flatMap(({ message }) => (message?.type === 'result' ? [message] : []))
  }
}

function call(name: string): AgentToolMessage & { type: 'call' } {
  return { type: 'call', id: crypto.randomUUID(), name, args: {}, agent }
}

/** Resolves once the calls handed so far have run. */
const settled = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe('serving agent tools through a room', () => {
  test('offers to run tools now and each time the tab reaches the relay, to the relay alone', () => {
    const room = channel()
    serveRoomAgentTools([...room.action], {
      store,
      onPeerJoin: room.onPeerJoin,
      run: async () => 1
    })
    room.join('another-tab')
    room.join(RELAY_SERVER_PEER)
    expect(room.sent).toEqual([
      { message: { type: 'host' }, target: RELAY_SERVER_PEER },
      { message: { type: 'host' }, target: RELAY_SERVER_PEER }
    ])
  })

  test("answers the relay's calls in the order they came, with results and failures", async () => {
    const room = channel()
    const ran: string[] = []
    const run: RunAgentTool = async (_store, { name }: AgentToolCall) => {
      ran.push(name)
      if (name === 'get_node') throw new Error('Node 9:9 not found')
      return { name }
    }
    serveRoomAgentTools([...room.action], { store, onPeerJoin: room.onPeerJoin, run })
    const first = call('render')
    const second = call('get_node')
    room.deliver(first)
    room.deliver(second)
    await settled()
    expect(ran).toEqual(['render', 'get_node'])
    expect(room.results()).toEqual([
      { type: 'result', id: first.id, ok: true, result: { name: 'render' } },
      { type: 'result', id: second.id, ok: false, error: 'Node 9:9 not found' }
    ])
  })

  test('ignores calls from anyone but the relay', async () => {
    const room = channel()
    const ran: string[] = []
    serveRoomAgentTools([...room.action], {
      store,
      onPeerJoin: room.onPeerJoin,
      run: async (_store, { name }) => {
        ran.push(name)
        return null
      }
    })
    room.deliver(call('delete_node'), 'another-tab')
    await settled()
    expect(ran).toEqual([])
  })

  test('never runs a call cancelled while it waited for its turn, and aborts one running', async () => {
    const room = channel()
    const ran: string[] = []
    let finish: (() => void) | undefined
    let aborted = false
    serveRoomAgentTools([...room.action], {
      store,
      onPeerJoin: room.onPeerJoin,
      run: async (_store, { name }, signal) => {
        ran.push(name)
        signal.addEventListener('abort', () => {
          aborted = true
        })
        await new Promise<void>((resolve) => {
          finish = resolve
        })
        return null
      }
    })
    const running = call('render')
    const waiting = call('delete_node')
    room.deliver(running)
    room.deliver(waiting)
    await settled()
    room.deliver({ type: 'cancel', id: waiting.id })
    room.deliver({ type: 'cancel', id: running.id })
    expect(aborted).toBe(true)
    finish?.()
    await settled()
    expect(ran).toEqual(['render'])
    expect(room.results()).toEqual([])
  })
})
