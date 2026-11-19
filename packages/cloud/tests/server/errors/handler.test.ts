import { describe, expect, spyOn, test } from 'bun:test'

import {
  cloudErrorHandler,
  createLoggingErrorReporter,
  type CloudErrorContext
} from '#cloud/server/errors'
import { cloudRequestId, type CloudLogLine } from '#cloud/server/logging'
import { validatedParams } from '#cloud/server/validation'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'

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

  test('names the signed-in user and the records its validated path names, never an invitation', async () => {
    const workspaceId = '2b1f4f0c-6d7e-4c55-9a0b-1f2e3d4c5b6a'
    const documentId = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
    const invitationId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    const uuid = v.pipe(v.string(), v.uuid())
    const reported: Reported[] = []
    const app = new Hono<{ Variables: { actor: { userId: string; email: string } } }>()
      .onError(
        cloudErrorHandler(async (error, context) => {
          reported.push({ error, context })
        })
      )
      .use('*', async (context, next) => {
        context.set('actor', { userId: 'user-1', email: 'jane@example.com' })
        await next()
      })
      .get(
        '/api/workspaces/:workspaceId/documents/:documentId',
        validatedParams(v.object({ workspaceId: uuid, documentId: uuid })),
        () => {
          throw failure
        }
      )
      .post(
        '/api/invitations/:invitationId/accept',
        validatedParams(v.object({ invitationId: uuid })),
        () => {
          throw failure
        }
      )
      // A path no validator checked: what the caller typed stays out of the report.
      .get('/api/unchecked/:documentId', () => {
        throw failure
      })

    await app.request(`/api/workspaces/${workspaceId}/documents/${documentId}`)
    await app.request(`/api/invitations/${invitationId}/accept`, { method: 'POST' })
    await app.request('/api/unchecked/jane@example.com')

    const request = { source: 'request', userId: 'user-1', message: 'Request failed' } as const
    expect(reported.map(({ context }) => context)).toEqual([
      {
        ...request,
        method: 'GET',
        route: '/api/workspaces/:workspaceId/documents/:documentId',
        resources: { workspaceId, documentId }
      },
      { ...request, method: 'POST', route: '/api/invitations/:invitationId/accept' },
      { ...request, method: 'GET', route: '/api/unchecked/:documentId' }
    ])
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

  test('still sends the report when the log cannot be written', async () => {
    const sent: unknown[] = []
    const report = createLoggingErrorReporter(
      () => {
        throw new Error('stdout closed')
      },
      async (error) => {
        sent.push(error)
      }
    )
    await report(failure, { source: 'background' })
    expect(sent).toEqual([failure])
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
