import { describe, expect, test } from 'bun:test'

import {
  createRelayClientAssembler,
  createRelayServerAssembler,
  decodeRelayClientFrame,
  decodeRelayServerFrame,
  defaultRelayURL,
  encodeRelayClientFrame,
  encodeRelayServerFrame,
  RELAY_FRAGMENT_BYTES,
  RELAY_MINIMUM_MESSAGE_BYTES,
  RELAY_PATH,
  relayClientMessages,
  relayServerMessages,
  type RelayClientFrame,
  type RelayServerFrame
} from '#cloud/contract'

describe('relay frames', () => {
  test('round-trip every client frame', () => {
    const frames: RelayClientFrame[] = [
      { type: 'auth', token: 'ticket' },
      { type: 'message', namespace: 'yjs-update', target: null, payload: new Uint8Array([1, 2]) },
      { type: 'message', namespace: 'sync-step1', target: 'server', payload: new Uint8Array() }
    ]
    for (const frame of frames) {
      expect(decodeRelayClientFrame(encodeRelayClientFrame(frame))).toEqual(frame)
    }
  })

  test('round-trip every server frame', () => {
    const frames: RelayServerFrame[] = [
      { type: 'welcome', peerId: 'a', peers: ['server', 'b'] },
      { type: 'join', peerId: 'c' },
      { type: 'leave', peerId: 'c' },
      { type: 'message', namespace: 'awareness', from: 'b', payload: new Uint8Array([9]) }
    ]
    for (const frame of frames) {
      expect(decodeRelayServerFrame(encodeRelayServerFrame(frame))).toEqual(frame)
    }
  })

  test('reject truncated and unknown frames', () => {
    const message = encodeRelayClientFrame({
      type: 'message',
      namespace: 'yjs-update',
      target: null,
      payload: new Uint8Array([1, 2, 3])
    })
    expect(decodeRelayClientFrame(message.subarray(0, -2))).toBeNull()
    expect(decodeRelayClientFrame(new Uint8Array([7]))).toBeNull()
    expect(decodeRelayServerFrame(new Uint8Array([7]))).toBeNull()
  })

  test('split large frames into messages that join back into the frame', () => {
    const payload = crypto.getRandomValues(new Uint8Array(RELAY_FRAGMENT_BYTES * 2 + 100))
    const client: RelayClientFrame = {
      type: 'message',
      namespace: 'yjs-update',
      target: null,
      payload
    }
    const server: RelayServerFrame = {
      type: 'message',
      namespace: 'yjs-update',
      from: 'a',
      payload
    }
    for (const [messages, assembler, decode, frame] of [
      [
        relayClientMessages(client),
        createRelayClientAssembler(() => Infinity),
        decodeRelayClientFrame,
        client
      ],
      [
        relayServerMessages(server),
        createRelayServerAssembler(() => Infinity),
        decodeRelayServerFrame,
        server
      ]
    ] as const) {
      expect(messages).toHaveLength(3)
      for (const message of messages)
        expect(message.byteLength).toBeLessThanOrEqual(RELAY_MINIMUM_MESSAGE_BYTES)
      const results = messages.map((message) => assembler.push(message))
      expect(results.slice(0, -1).map((result) => result.type)).toEqual(['partial', 'partial'])
      const last = results.at(-1)
      expect(last?.type === 'frame' ? decode(last.data) : null).toEqual(frame)
    }
  })

  test('send small frames whole and refuse joined frames past the limit', () => {
    const small: RelayClientFrame = { type: 'auth', token: 'ticket' }
    expect(relayClientMessages(small)).toEqual([encodeRelayClientFrame(small)])
    const assembler = createRelayClientAssembler(() => RELAY_FRAGMENT_BYTES)
    const [first, second] = relayClientMessages({
      type: 'message',
      namespace: 'yjs-update',
      target: null,
      payload: new Uint8Array(RELAY_FRAGMENT_BYTES * 2)
    })
    if (!first || !second) throw new Error('Expected two fragments')
    expect(assembler.push(first).type).toBe('partial')
    expect(assembler.push(second).type).toBe('too-large')
    // The assembler starts over after refusing.
    expect(assembler.push(encodeRelayClientFrame(small)).type).toBe('frame')
  })

  test('discard the rest of a refused frame instead of reading its tail as a frame', () => {
    const assembler = createRelayClientAssembler(() => RELAY_FRAGMENT_BYTES)
    const messages = relayClientMessages({
      type: 'message',
      namespace: 'yjs-update',
      target: null,
      payload: new Uint8Array(RELAY_FRAGMENT_BYTES * 4)
    })
    const results = messages.map((message) => assembler.push(message).type)
    expect(results).toEqual(['partial', 'too-large', 'partial', 'partial', 'partial'])
    const small: RelayClientFrame = { type: 'auth', token: 'ticket' }
    expect(assembler.push(encodeRelayClientFrame(small)).type).toBe('frame')
  })

  test('discard what follows a fragment whose flag cannot be trusted', () => {
    const assembler = createRelayClientAssembler(() => Infinity)
    const messages = relayClientMessages({
      type: 'message',
      namespace: 'yjs-update',
      target: null,
      payload: new Uint8Array(RELAY_FRAGMENT_BYTES * 3)
    })
    const [first, ...rest] = messages
    if (!first) throw new Error('Expected a fragment')
    // The first fragment with its flag rewritten to 2, which is neither "more" nor "last".
    const garbled = Uint8Array.from(first)
    garbled[1] = 2
    expect(assembler.push(garbled).type).toBe('malformed')
    expect(rest.map((message) => assembler.push(message).type)).toEqual(rest.map(() => 'partial'))
    expect(assembler.push(encodeRelayClientFrame({ type: 'auth', token: 'ticket' })).type).toBe(
      'frame'
    )
  })
})

describe('default relay URL', () => {
  test('uses the API origin with a WebSocket scheme', () => {
    expect(defaultRelayURL('https://cloud.example.com')).toBe(
      `wss://cloud.example.com${RELAY_PATH}`
    )
    expect(defaultRelayURL('http://localhost:8787/')).toBe(`ws://localhost:8787${RELAY_PATH}`)
  })
})
