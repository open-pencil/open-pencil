import type { InklyAuth, InklyAuthSession } from '../../packages/api/src/auth/index.js'
import { users } from '../../packages/api/src/db/schema.js'
import type { createTestApiApp } from './api.js'

export const TEST_USER_HEADER = 'X-Test-User-Id'

export function createSession(
  userId: string,
  name = `User ${userId}`,
  email = `${userId}@example.com`
): InklyAuthSession {
  return {
    session: {
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      expiresAt: '2030-01-01T00:00:00.000Z',
      createdAt: '2029-01-01T00:00:00.000Z',
      updatedAt: '2029-01-01T00:00:00.000Z'
    },
    user: {
      id: userId,
      name,
      email,
      emailVerified: true,
      image: null,
      createdAt: '2029-01-01T00:00:00.000Z',
      updatedAt: '2029-01-01T00:00:00.000Z'
    }
  }
}

export function createHeaderAuth(sessions: InklyAuthSession[]): InklyAuth {
  const sessionByUserId = new Map(sessions.map((session) => [session.user.id, session]))

  return {
    async handler(request) {
      const session = sessionByUserId.get(request.headers.get(TEST_USER_HEADER)?.trim() ?? '')
      if (!session) {
        return Response.json(
          {
            error: {
              code: 'unauthorized',
              message: 'No active session'
            }
          },
          { status: 401 }
        )
      }

      return Response.json(session)
    },
    async getSession(request) {
      return sessionByUserId.get(request.headers.get(TEST_USER_HEADER)?.trim() ?? '') ?? null
    }
  }
}

export async function seedUsers(
  database: Awaited<ReturnType<typeof createTestApiApp>>['database'],
  sessions: InklyAuthSession[]
) {
  for (const session of sessions) {
    await database.db
      .insert(users)
      .values({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        image: session.user.image,
        createdAt: new Date(session.user.createdAt),
        updatedAt: new Date(session.user.updatedAt)
      })
      .run()
  }
}
