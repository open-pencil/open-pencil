import { describe, expect, spyOn, test } from 'bun:test'

import { cloudRequestId, loggedError, logCloud } from '#cloud/server/logging'
import { Hono } from 'hono'

function appNaming(forwarded?: (headers: Headers) => string | undefined) {
  return new Hono<{ Variables: { requestId: string } }>()
    .use('*', cloudRequestId(forwarded))
    .get('/', (context) => context.text(context.get('requestId')))
}

describe('cloudRequestId', () => {
  test('names the request as the runtime trusts it and answers with the ID', async () => {
    const response = await appNaming(() => 'ray-1').request('/')
    expect(response.headers.get('X-Request-Id')).toBe('ray-1')
    expect(await response.text()).toBe('ray-1')
  })

  test('makes an ID when the runtime trusts nothing in front', async () => {
    const response = await appNaming().request('/', { headers: { 'cf-ray': '8f1e2d3c4b5a6978' } })
    const id = response.headers.get('X-Request-Id')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await response.text()).toBe(id ?? '')
  })
})

describe('logCloud', () => {
  test('writes one line of JSON at its level', () => {
    const logged = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      logCloud('warn', 'Giving up failed', { uploads: 2 })
      expect(logged.mock.calls).toEqual([
        [JSON.stringify({ uploads: 2, level: 'warn', message: 'Giving up failed' })]
      ])
    } finally {
      logged.mockRestore()
    }
  })
})

describe('loggedError', () => {
  test('keeps the name, message, stack, and causes', () => {
    const error = new TypeError('outer', { cause: new Error('inner') })
    expect(loggedError(error)).toMatchObject({
      name: 'TypeError',
      message: 'outer',
      stack: expect.stringContaining('outer'),
      cause: { name: 'Error', message: 'inner' }
    })
    expect(loggedError('text')).toEqual({ name: 'NonError', message: 'text' })
  })
})
