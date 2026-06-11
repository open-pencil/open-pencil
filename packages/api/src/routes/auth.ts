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

  // 信頼する origin (環境変数 INKLY_API_BETTER_AUTH_BASE_URL から導出)。
  // x-forwarded-host による host 注入を防ぐため、 baseURL の host と一致するときだけ rewrite する。
  let trustedHost: string | null = null
  let trustedProto: 'http' | 'https' = 'https'
  try {
    const baseURL = process.env.INKLY_API_BETTER_AUTH_BASE_URL
    if (baseURL) {
      const u = new URL(baseURL)
      trustedHost = u.host
      trustedProto = u.protocol === 'http:' ? 'http' : 'https'
    }
  } catch {
    // 不正な baseURL は無視 (URL 再構築を行わない)
  }

  app.all('/*', (c) => {
    // Fly proxy 経由のリクエストは c.req.raw の URL が `http://0.0.0.0:3001/...`
    // (内部 listen address) になっており、 better-auth が baseURL (production の
    // `https://pencil-editor.fly.dev`) との origin 不一致で state cookie 検証や
    // OAuth callback の URL 解決に失敗する。 x-forwarded-proto / host から
    // 公開 origin を再構築して request を作り直す。
    //
    // セキュリティ: x-forwarded-host は信頼できない外部ヘッダのため、
    //   - `,` 区切りなら最初の値だけを使用
    //   - protocol は `http`/`https` のみ許可
    //   - baseURL から導出した trustedHost と一致するときだけ rewrite する
    //   (一致しない場合は raw request をそのまま pass、 baseURL 未設定なら raw)
    const rawForwardedHost = c.req.header('x-forwarded-host') ?? c.req.header('host')
    const rawForwardedProto = c.req.header('x-forwarded-proto')

    if (!rawForwardedHost || !trustedHost) {
      return options.auth.handler(c.req.raw)
    }

    // `,` 区切りなら先頭値だけ取る (proxy chain で複数 host が並ぶケース)
    const forwardedHost = rawForwardedHost.split(',')[0]?.trim() ?? ''
    const forwardedProto = (rawForwardedProto?.split(',')[0]?.trim() ?? trustedProto).toLowerCase()

    if (forwardedProto !== 'http' && forwardedProto !== 'https') {
      return options.auth.handler(c.req.raw)
    }

    // trustedHost と完全一致するときだけ rewrite。 それ以外は host 注入の疑いがあるので raw を pass
    if (forwardedHost !== trustedHost) {
      return options.auth.handler(c.req.raw)
    }

    const original = new URL(c.req.url)
    const rewritten = new URL(original.pathname + original.search, `${forwardedProto}://${forwardedHost}`)
    const rewrittenRequest = new Request(rewritten, {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
      body: ['GET', 'HEAD'].includes(c.req.raw.method) ? undefined : c.req.raw.body,
      // @ts-expect-error duplex required for streaming bodies in Node 20+
      duplex: 'half'
    })
    return options.auth.handler(rewrittenRequest)
  })

  return app
}
