import { Hono } from 'hono'
import { z } from 'zod'

import { INKLY_ANONYMOUS_ID_HEADER } from '../anonymousId.js'
import { getAuthSession, type InklyAuth } from '../auth/index.js'
import { migrateAnonymousOwnership } from '../auth/migrate.js'
import type { ApiDatabase } from '../db/client.js'

const testLoginSchema = z.object({
  email: z.string().trim().email().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  image: z.string().trim().url().nullable().optional()
})

const testLoginRedirectSchema = testLoginSchema.extend({
  callbackURL: z.string().trim().min(1).optional()
})

export interface AuthRoutesOptions {
  auth: InklyAuth
  database: ApiDatabase
  now?: () => number
}

function unauthorizedResponse(headers?: HeadersInit) {
  return new Response(
    JSON.stringify({
      error: {
        code: 'unauthorized',
        message: 'No active session'
      }
    }),
    {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...headers
      }
    }
  )
}

async function proxySession(auth: InklyAuth, request: Request): Promise<Response> {
  const session = await getAuthSession(auth, request)
  if (session) {
    return Response.json(session)
  }

  return unauthorizedResponse()
}

function appendSetCookieHeaders(headers: Headers, values: string[]) {
  for (const value of values) {
    headers.append('set-cookie', value)
  }
}

function notFoundTestLoginResponse() {
  return Response.json(
    {
      error: {
        code: 'not_found',
        message: 'Test login is not enabled'
      }
    },
    { status: 404 }
  )
}

export function createAuthRoutes(options: AuthRoutesOptions): Hono {
  const app = new Hono()

  app.get('/session', (c) => proxySession(options.auth, c.req.raw))

  app.post('/migrate-anonymous', async (c) => {
    const session = await getAuthSession(options.auth, c.req.raw)
    if (!session) return unauthorizedResponse()

    const anonymousId = c.req.header(INKLY_ANONYMOUS_ID_HEADER)?.trim()
    if (!anonymousId) {
      return c.json(
        {
          error: {
            code: 'missing_anonymous_id',
            message: 'Missing X-Inkly-Anonymous-Id header'
          }
        },
        400
      )
    }

    const result = await migrateAnonymousOwnership({
      database: options.database,
      anonymousId,
      userId: session.user.id,
      now: options.now
    })

    return c.json({
      migrated: result.migratedBoardCount > 0,
      migratedBoardCount: result.migratedBoardCount,
      removedOwnerCollaboratorCount: result.removedOwnerCollaboratorCount
    })
  })

  app.get('/test/login', async (c) => {
    if (!options.auth.createTestSession) {
      return notFoundTestLoginResponse()
    }

    const parsed = testLoginRedirectSchema.safeParse(c.req.query())
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid query string'
      return c.json(
        {
          error: {
            code: 'invalid_request_query',
            message: issue
          }
        },
        400
      )
    }

    const result = await options.auth.createTestSession(parsed.data)
    const headers = new Headers()
    appendSetCookieHeaders(headers, result.setCookieHeaders)

    if (parsed.data.callbackURL) {
      headers.set('location', parsed.data.callbackURL)
      return new Response(null, {
        status: 302,
        headers
      })
    }

    headers.set('content-type', 'application/json; charset=utf-8')
    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    })
  })

  app.post('/test/login', async (c) => {
    if (!options.auth.createTestSession) {
      return notFoundTestLoginResponse()
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = testLoginSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return c.json(
        {
          error: {
            code: 'invalid_request_body',
            message: issue
          }
        },
        400
      )
    }

    const result = await options.auth.createTestSession(parsed.data)
    const headers = new Headers()
    appendSetCookieHeaders(headers, result.setCookieHeaders)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    })
  })

  app.all('/*', (c) => options.auth.handler(c.req.raw))

  return app
}
