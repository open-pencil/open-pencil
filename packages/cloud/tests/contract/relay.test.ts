import { describe, expect, test } from 'bun:test'

import {
  decodeRelayClientFrame,
  decodeRelayServerFrame,
  encodeRelayClientFrame,
  encodeRelayServerFrame,
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
})
