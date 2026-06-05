import { Hono } from 'hono'

import type { InklyAuth } from '../auth/index.js'

export interface AuthRoutesOptions {
  auth: InklyAuth
}

function rewritePathname(url: URL, suffix: string) {
  const pathname = url.pathname.replace(/\/+$/, '')
  const updatedPathname = pathname.replace(/\/session$/, suffix)
  url.pathname = updatedPathname
}

async function proxySession(auth: InklyAuth, request: Request): Promise<Response> {
  const url = new URL(request.url)
  rewritePathname(url, '/get-session')

  const sessionResponse = await auth.handler(
    new Request(url, {
      method: 'GET',
      headers: request.headers
    })
  )

  const session = await sessionResponse.clone().json().catch(() => null)
  if (session !== null) {
    return sessionResponse
  }

  const headers = new Headers(sessionResponse.headers)
  headers.set('content-type', 'application/json; charset=utf-8')

  return new Response(
    JSON.stringify({
      error: {
        code: 'unauthorized',
        message: 'No active session'
      }
    }),
    {
      status: 401,
      headers
    }
  )
}

export function createAuthRoutes(options: AuthRoutesOptions): Hono {
  const app = new Hono()

  app.get('/session', (c) => proxySession(options.auth, c.req.raw))
  app.all('/*', (c) => options.auth.handler(c.req.raw))

  return app
}
