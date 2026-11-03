import { describe, expect, spyOn, test } from 'bun:test'

import { cloudErrorHandler, type CloudErrorContext } from '#cloud/server/errors'
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
