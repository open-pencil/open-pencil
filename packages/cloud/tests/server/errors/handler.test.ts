import { describe, expect, spyOn, test } from 'bun:test'

import { cloudErrorHandler, type CloudErrorContext } from '#cloud/server/errors'
import { cloudRequestId } from '#cloud/server/logging'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

type Reported = { error: unknown; context: CloudErrorContext }

const failure = new Error('database unavailable')

function appReporting(reported: Reported[]) {
  return new Hono()
    .onError(
      cloudErrorHandler(async (error, context) => {
        reported.push({ error, context })
      })
    )
    .get('/api/documents/:id', () => {
      throw failure
    })
    .get('/api/limited', () => {
      throw new HTTPException(429, { message: 'slow down' })
    })
}

describe('Cloud error handler', () => {
  test('reports an unhandled error with its route pattern and answers 500', async () => {
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    const reported: Reported[] = []
    try {
      const response = await appReporting(reported).request('/api/documents/secret-id')
      expect(response.status).toBe(500)
      expect(await response.text()).toBe('Internal Server Error')
      expect(reported).toHaveLength(1)
      expect(reported[0]?.error).toBe(failure)
      expect(reported[0]?.context).toEqual({
        source: 'request',
        method: 'GET',
        route: '/api/documents/:id'
      })
      expect(logged).toHaveBeenCalledTimes(1)
    } finally {
      logged.mockRestore()
    }
  })

  test('names the request by its ray ID in the log line, the report, and the response', async () => {
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    const reported: Reported[] = []
    try {
      const app = new Hono()
        .onError(
          cloudErrorHandler(async (error, context) => {
            reported.push({ error, context })
          })
        )
        .use('*', cloudRequestId)
        .get('/api/documents/:id', () => {
          throw failure
        })
      const ray = '8f1e2d3c4b5a6978-FRA'
      const response = await app.request('/api/documents/secret-id', {
        headers: { 'cf-ray': ray }
      })
      expect(response.status).toBe(500)
      expect(response.headers.get('X-Request-Id')).toBe(ray)
      expect(reported[0]?.context.requestId).toBe(ray)
      const [line] = logged.mock.calls[0] ?? []
      expect(typeof line === 'string' ? JSON.parse(line) : line).toMatchObject({
        level: 'error',
        message: 'Request failed',
        source: 'request',
        route: '/api/documents/:id',
        requestId: ray,
        error: { name: 'Error', message: 'database unavailable' }
      })
    } finally {
      logged.mockRestore()
    }
  })

  test('answers an HTTP exception with its own response and reports nothing', async () => {
    const reported: Reported[] = []
    const response = await appReporting(reported).request('/api/limited')
    expect(response.status).toBe(429)
    expect(reported).toEqual([])
  })

  test('still answers 500 when the deployment reports nothing', async () => {
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const app = new Hono().onError(cloudErrorHandler(undefined)).get('/', () => {
        throw new Error('broken')
      })
      expect((await app.request('/')).status).toBe(500)
    } finally {
      logged.mockRestore()
    }
  })
})
