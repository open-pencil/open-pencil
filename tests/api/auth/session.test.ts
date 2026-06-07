import { describe, expect, test } from 'bun:test'

import type { InklyAuth } from '../../../packages/api/src/auth/index.js'
import { createTestApiApp, TEST_API_SECRET } from '../../helpers/api.js'

describe('auth session route', () => {
  test('returns 401 when no session is active', async () => {
    const { app, database } = await createTestApiApp({
      secret: TEST_API_SECRET
    })

    const response = await app.request('/api/auth/session')

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: 'No active session'
      }
    })

    database.close()
  })

  test('returns 200 when the auth handler provides a session', async () => {
    const auth: InklyAuth = {
      async handler(request) {
        const url = new URL(request.url)

        if (url.pathname.endsWith('/get-session')) {
          return Response.json({
            session: {
              id: 'session-123',
              token: 'token-123',
              userId: 'user-123',
              expiresAt: new Date('2030-01-01T00:00:00.000Z').toISOString(),
              createdAt: new Date('2029-01-01T00:00:00.000Z').toISOString(),
              updatedAt: new Date('2029-01-01T00:00:00.000Z').toISOString()
            },
            user: {
              id: 'user-123',
              name: 'Test User',
              email: 'user@example.com',
              emailVerified: true,
              image: null,
              createdAt: new Date('2029-01-01T00:00:00.000Z').toISOString(),
              updatedAt: new Date('2029-01-01T00:00:00.000Z').toISOString()
            }
          })
        }

        return Response.json(
          {
            error: {
              code: 'not_found',
              message: 'Not found'
            }
          },
          { status: 404 }
        )
      }
    }

    const { app, database } = await createTestApiApp({
      auth,
      secret: TEST_API_SECRET
    })

    const response = await app.request('/api/auth/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      session: {
        id: 'session-123',
        token: 'token-123',
        userId: 'user-123',
        expiresAt: '2030-01-01T00:00:00.000Z',
        createdAt: '2029-01-01T00:00:00.000Z',
        updatedAt: '2029-01-01T00:00:00.000Z'
      },
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'user@example.com',
        emailVerified: true,
        image: null,
        createdAt: '2029-01-01T00:00:00.000Z',
        updatedAt: '2029-01-01T00:00:00.000Z'
      }
    })

    database.close()
  })
})
