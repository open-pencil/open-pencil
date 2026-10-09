import { afterEach, describe, expect, test } from 'bun:test'

import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  createRemotePreviewRouter,
  decodeAgentPreview,
  encodeAgentPreview,
  encodeAgentPreviewMessages,
  MAX_PREVIEW_DELTA_LENGTH,
  shareAgentPreviews,
  type RemotePreviewController
} from '@/app/collab/agent-preview'
import { connectCollabRoom } from '@/app/collab/room/connection'
import { createEditorStore } from '@/app/editor/session'
import { publishAgentPreview, type AgentPreviewEvent } from '@/app/presence/preview-stream'

import { createMemoryRooms } from '#tests/helpers/collab/memory-transport'

const ROOM = 'cccccccccccccccccccccccccccccccc'

/** Records what a remote preview controller is asked to draw. */
function recordingController() {
  const log: string[] = []
  const controller: RemotePreviewController = {
    start: (callId) => log.push(`start ${callId}`),
    delta: (callId, text) => log.push(`delta ${callId} ${text}`),
    finish: (callId) => log.push(`finish ${callId}`),
    clear: () => log.push('clear')
  }
  return { log, controller }
}

/** Call keys name the peer, the agent, and the call. */
const callKey = (peerId: string, agentId: string, callId: string) =>
  `${peerId}\u0000${agentId}\u0000${callId}`

describe('agent preview messages', () => {
  test('carry every event kind through encoding', () => {
    const events: AgentPreviewEvent[] = [
      { type: 'start', agentId: 'a1', callId: 'c1', pageId: '0:1' },
      { type: 'delta', agentId: 'a1', callId: 'c1', text: '{"jsx":"<Frame' },
      { type: 'finish', agentId: 'a1', callId: 'c1' },
      { type: 'clear', agentId: 'a1' }
    ]
    for (const event of events) expect(decodeAgentPreview(encodeAgentPreview(event))).toEqual(event)
  })

  test('reject what a broken or hostile peer could send', () => {
    const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
    expect(decodeAgentPreview(new TextEncoder().encode('not json'))).toBeNull()
    expect(decodeAgentPreview(encode({ type: 'start', agentId: 'a1', callId: 'c1' }))).toBeNull()
    expect(decodeAgentPreview(encode({ type: 'run', agentId: 'a1' }))).toBeNull()
    expect(decodeAgentPreview(encode({ type: 'clear', agentId: 'x'.repeat(65) }))).toBeNull()
    expect(
      decodeAgentPreview(
        encode({
          type: 'delta',
          agentId: 'a1',
          callId: 'c1',
          text: 'x'.repeat(MAX_PREVIEW_DELTA_LENGTH + 1)
        })
      )
    ).toBeNull()
  })
})

test('a delta longer than peers accept goes as several that rejoin intact', () => {
  // A surrogate pair straddles the first split, as an emoji in streamed text can.
  const text = `${'x'.repeat(MAX_PREVIEW_DELTA_LENGTH - 1)}😀${'y'.repeat(MAX_PREVIEW_DELTA_LENGTH)}`
  const messages = encodeAgentPreviewMessages({ type: 'delta', agentId: 'a1', callId: 'c1', text })

  expect(messages).toHaveLength(3)
  const decoded = messages.map((message) => decodeAgentPreview(message))
  expect(decoded.every((event) => event?.type === 'delta')).toBe(true)
  expect(decoded.map((event) => (event?.type === 'delta' ? event.text : '')).join('')).toBe(text)
})

describe('remote preview routing', () => {
  test("keeps each peer's agents apart and draws a call on its page", () => {
    const { log, controller } = recordingController()
    const pages: string[] = []
    const router = createRemotePreviewRouter(controller, (pageId) => pages.push(pageId))

    router.receive({ type: 'start', agentId: 'a1', callId: 'c1', pageId: '0:1' }, 'peer-1')
    router.receive({ type: 'start', agentId: 'a1', callId: 'c1', pageId: '0:2' }, 'peer-2')
    router.receive({ type: 'delta', agentId: 'a1', callId: 'c1', text: '<Frame' }, 'peer-2')
    router.receive({ type: 'finish', agentId: 'a1', callId: 'c1' }, 'peer-1')

    expect(pages).toEqual(['0:1', '0:2'])
    expect(log).toEqual([
      `start ${callKey('peer-1', 'a1', 'c1')}`,
      `start ${callKey('peer-2', 'a1', 'c1')}`,
      `delta ${callKey('peer-2', 'a1', 'c1')} <Frame`,
      `finish ${callKey('peer-1', 'a1', 'c1')}`
    ])
  })

  test('ignores a call it joined midway, and ends calls on clear or when the peer leaves', () => {
    const { log, controller } = recordingController()
    const router = createRemotePreviewRouter(controller, () => undefined)

    router.receive({ type: 'delta', agentId: 'a1', callId: 'missed', text: 'x' }, 'peer-1')
    router.receive({ type: 'start', agentId: 'a1', callId: 'c1', pageId: '0:1' }, 'peer-1')
    router.receive({ type: 'start', agentId: 'a2', callId: 'c2', pageId: '0:1' }, 'peer-1')
    router.receive({ type: 'clear', agentId: 'a1' }, 'peer-1')
    router.peerLeft('peer-1')

    expect(log).toEqual([
      `start ${callKey('peer-1', 'a1', 'c1')}`,
      `start ${callKey('peer-1', 'a2', 'c2')}`,
      `finish ${callKey('peer-1', 'a1', 'c1')}`,
      `finish ${callKey('peer-1', 'a2', 'c2')}`
    ])
  })
})

describe('agent previews in a room', () => {
  const cleanups: (() => void)[] = []
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup()
  })

  function connect(rooms: ReturnType<typeof createMemoryRooms>) {
    const ydoc = new Y.Doc()
    const awareness = new Awareness(ydoc)
    const connection = connectCollabRoom({
      roomId: ROOM,
      ydoc,
      awareness,
      updatePeersList: () => undefined,
      joinRoom: rooms.join
    })
    const store = createEditorStore(new SceneGraph())
    cleanups.push(() => {
      store.preparationController.dispose()
      awareness.destroy()
      ydoc.destroy()
    })
    return { connection, store }
  }

  test("show the host's streamed render input on the guest, and end it when the host leaves", async () => {
    const rooms = createMemoryRooms()
    const host = connect(rooms)
    const guest = connect(rooms)
    const { log, controller } = recordingController()
    const stopHost = shareAgentPreviews(
      host.store,
      host.connection,
      () => recordingController().controller
    )
    const stopGuest = shareAgentPreviews(guest.store, guest.connection, () => controller)
    cleanups.push(stopHost, stopGuest)
    await rooms.settle()

    publishAgentPreview(host.store, { type: 'start', agentId: 'a1', callId: 'c1', pageId: '0:1' })
    publishAgentPreview(host.store, { type: 'delta', agentId: 'a1', callId: 'c1', text: '<Frame' })
    await rooms.settle()
    expect(log).toHaveLength(2)
    expect(log[0]).toStartWith('start ')
    expect(log[1]).toEndWith(' <Frame')

    await host.connection.room.leave()
    await rooms.settle()
    expect(log).toHaveLength(3)
    expect(log[2]).toStartWith('finish ')
  })
})
