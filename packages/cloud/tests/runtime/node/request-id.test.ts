import { describe, expect, test } from 'bun:test'

import { proxyRequestId } from '#cloud/runtime/node/request-id'

describe('proxyRequestId', () => {
  test('keeps the ID a proxy in front set', () => {
    expect(proxyRequestId(new Headers({ 'x-request-id': 'b6f0c1d2-proxy' }))).toBe('b6f0c1d2-proxy')
  })

  test('keeps nothing that could break a log line', () => {
    expect(proxyRequestId(new Headers({ 'x-request-id': 'a b' }))).toBeUndefined()
    expect(proxyRequestId(new Headers({ 'x-request-id': 'x'.repeat(129) }))).toBeUndefined()
    expect(proxyRequestId(new Headers())).toBeUndefined()
  })
})
