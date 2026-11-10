import { describe, expect, spyOn, test } from 'bun:test'

import {
  cloudErrorHandler,
  createLoggingErrorReporter,
  type CloudErrorContext
} from '#cloud/server/errors'
import { cloudRequestId, type CloudLogLine } from '#cloud/server/logging'
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
        route: '/api/documents/:id',
        message: 'Request failed'
      })
      // Logging is the runtime reporter's, which this stub is not.
      expect(logged).not.toHaveBeenCalled()
    } finally {
      logged.mockRestore()
    }
  })

  test('logs with the runtime’s writer, naming the request in its line, report, and response', async () => {
    const lines: CloudLogLine[] = []
    const reported: Reported[] = []
    const app = new Hono()
      .onError(
        cloudErrorHandler(
          createLoggingErrorReporter(
            (line) => lines.push(line),
            async (error, context) => {
              reported.push({ error, context })
            }
          )
        )
      )
      .use(
        '*',
        cloudRequestId(() => 'ray-1')
      )
      .get('/api/documents/:id', () => {
        throw failure
      })
    const response = await app.request('/api/documents/secret-id')
    expect(response.status).toBe(500)
    expect(response.headers.get('X-Request-Id')).toBe('ray-1')
    expect(reported[0]?.context.requestId).toBe('ray-1')
    expect(lines).toMatchObject([
      {
        level: 'error',
        message: 'Request failed',
        source: 'request',
        method: 'GET',
        route: '/api/documents/:id',
        requestId: 'ray-1',
        error: { name: 'Error', message: 'database unavailable' }
      }
    ])
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
      const [line] = logged.mock.calls[0] ?? []
      expect(typeof line === 'string' && JSON.parse(line)).toMatchObject({
        level: 'error',
        message: 'Request failed',
        error: { message: 'broken' }
      })
    } finally {
      logged.mockRestore()
    }
  })
})
