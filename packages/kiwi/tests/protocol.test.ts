import { describe, expect, test } from 'bun:test'

import {
  buildMultiplayerUrl,
  getKiwiMessageType,
  hasFigWireHeader,
  isKiwiMessage,
  isZstdCompressed,
  parseVarint,
  skipFigWireHeader,
  ZSTD_MAGIC
} from '../src/fig'

describe('Figma Kiwi protocol helpers', () => {
  test('detects Zstd magic bytes', () => {
    expect(isZstdCompressed(ZSTD_MAGIC)).toBe(true)
    expect(isZstdCompressed(new Uint8Array([1, 2, 3, 4]))).toBe(false)
  })

  test('reads Kiwi message type from minimal payloads', () => {
    const payload = new Uint8Array([1, 4, 0])
    expect(isKiwiMessage(payload)).toBe(true)
    expect(getKiwiMessageType(payload)).toBe(4)
    expect(getKiwiMessageType(new Uint8Array([2, 4, 0]))).toBeNull()
  })

  test('parses representative varints', () => {
    expect(parseVarint(new Uint8Array([0]), 0)).toEqual([0, 1])
    expect(parseVarint(new Uint8Array([127]), 0)).toEqual([127, 1])
    expect(parseVarint(new Uint8Array([128, 1]), 0)).toEqual([128, 2])
  })

  test('handles fig-wire headers', () => {
    const payload = new Uint8Array([
      ...new TextEncoder().encode('fig-wire'),
      1,
      0,
      0,
      0,
      40,
      181,
      47,
      253
    ])
    expect(hasFigWireHeader(payload)).toBe(true)
    expect(skipFigWireHeader(payload)).toEqual(ZSTD_MAGIC)
  })

  test('builds multiplayer URLs', () => {
    const url = new URL(buildMultiplayerUrl('file-key', 'tracking-id'))
    expect(url.protocol).toBe('wss:')
    expect(url.pathname).toBe('/api/multiplayer/file-key')
    expect(url.searchParams.get('role')).toBe('editor')
    expect(url.searchParams.get('tracking_session_id')).toBe('tracking-id')
  })
})
