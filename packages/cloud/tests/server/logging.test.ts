import { describe, expect, test } from 'bun:test'

import { cloudRequestId, forwardedRequestId, loggedError } from '#cloud/server/logging'
import { Hono } from 'hono'

describe('forwardedRequestId', () => {
  test('prefers Cloudflare’s ray ID over a proxy’s request ID', () => {
    const headers = new Headers({ 'cf-ray': '8f1e2d3c4b5a6978-FRA', 'x-request-id': 'proxy-1' })
    expect(forwardedRequestId(headers)).toBe('8f1e2d3c4b5a6978-FRA')
    expect(forwardedRequestId(new Headers({ 'x-request-id': 'proxy-1' }))).toBe('proxy-1')
  })

  test('keeps neither when it is not shaped like one', () => {
    const headers = new Headers({ 'cf-ray': 'not-a-ray', 'x-request-id': 'a b' })
    expect(forwardedRequestId(headers)).toBeUndefined()
  })
})

describe('cloudRequestId', () => {
  test('makes an ID when nothing in front named the request', async () => {
    const app = new Hono<{ Variables: { requestId: string } }>()
      .use('*', cloudRequestId)
      .get('/', (context) => context.text(context.get('requestId')))
    const response = await app.request('/')
    const id = response.headers.get('X-Request-Id')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await response.text()).toBe(id ?? '')
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
