import { describe, expect, test } from 'bun:test'

import { parseDiscoveryInfo } from '@open-pencil/mcp/discovery'

const VALID = {
  pid: 4242,
  socketPath: '/tmp/open-pencil.sock',
  httpPort: 7600,
  authRequired: true,
  authToken: 'token',
  version: '1.0.0',
  startedAt: '2026-01-01T00:00:00.000Z'
}

describe('parseDiscoveryInfo', () => {
  test('defaults disabledTools to an empty list and the scope to the document', () => {
    expect(parseDiscoveryInfo(JSON.stringify(VALID))).toEqual({
      ...VALID,
      disabledTools: [],
      scope: 'document'
    })
    expect(
      parseDiscoveryInfo(JSON.stringify({ ...VALID, disabledTools: ['eval'], scope: 'selection' }))
    ).toEqual({ ...VALID, disabledTools: ['eval'], scope: 'selection' })
  })

  test.each([
    ['malformed JSON', '{not json'],
    ['a non-object', '[]'],
    ['a non-string token', JSON.stringify({ ...VALID, authToken: 42 })],
    ['an empty socket path', JSON.stringify({ ...VALID, socketPath: '' })],
    ['an out-of-range port', JSON.stringify({ ...VALID, httpPort: 70_000 })],
    ['a non-positive pid', JSON.stringify({ ...VALID, pid: 0 })],
    ['non-string disabled tools', JSON.stringify({ ...VALID, disabledTools: [1] })]
  ])('rejects %s', (_label, raw) => {
    expect(parseDiscoveryInfo(raw)).toBeNull()
  })
})
