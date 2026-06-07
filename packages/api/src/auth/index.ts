import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { testUtils } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'

import type { ApiDatabase } from '../db/client.js'
import { users } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { INKLY_API_AUTH_BASE_PATH, resolveInklyAuthConfig } from './config.js'

export interface InklyAuthSession {
  session: {
    id: string
    token: string
    userId: string
    expiresAt: string
    createdAt: string
    updatedAt: string
  }
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
    updatedAt: string
  }
}

export interface InklyAuthTestSessionInput {
  email?: string
  name?: string
  image?: string | null
}

export interface InklyAuthTestSession extends InklyAuthSession {
  setCookieHeaders: string[]
}

export interface InklyAuth {
  handler(request: Request): Promise<Response>
  getSession?(request: Request): Promise<InklyAuthSession | null>
  createTestSession?(input: InklyAuthTestSessionInput): Promise<InklyAuthTestSession>
}

export interface CreateInklyAuthOptions {
  database: ApiDatabase
  env?: NodeJS.ProcessEnv
  fallbackSecret: string
  logger?: Pick<Console, 'warn'>
}

interface BetterAuthTestContext {
  test: {
    createUser(input: { email: string; name: string; image: string | null }): unknown
    saveUser(input: unknown): Promise<{ id: string }>
    login(input: { userId: string }): Promise<{
      session: {
        id: string
        token: string
        userId: string
        expiresAt: Date
        createdAt: Date
        updatedAt: Date
      }
      user: {
        id: string
        name: string
        email: string
        emailVerified: boolean
        image: string | null
        createdAt: Date
        updatedAt: Date
      }
      cookies: Array<{
        name: string
        value: string
        domain: string
        path: string
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'Lax' | 'Strict' | 'None'
        expires?: number
        maxAge?: number
      }>
    }>
  }
}

function setSessionPathname(url: URL, basePath: string) {
  url.pathname = `${basePath.replace(/\/+$/, '')}/get-session`
}

function serializeTestCookie(
  cookie: {
    name: string
    value: string
    domain: string
    path: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
    expires?: number
    maxAge?: number
  },
  fallbackExpires?: number
) {
  const parts = [`${cookie.name}=${cookie.value}`, `Path=${cookie.path || '/'}`]

  if (cookie.domain) parts.push(`Domain=${cookie.domain}`)
  if (cookie.httpOnly) parts.push('HttpOnly')
  if (cookie.secure) parts.push('Secure')
  if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`)
  if (typeof cookie.maxAge === 'number') {
    parts.push(`Max-Age=${cookie.maxAge}`)
  }

  const expiresAt =
    typeof cookie.expires === 'number' && cookie.expires > Date.now()
      ? cookie.expires
      : fallbackExpires

  if (typeof expiresAt === 'number') {
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`)
  }

  return parts.join('; ')
}

async function getSessionFromHandler(
  auth: Pick<InklyAuth, 'handler'>,
  request: Request,
  basePath = INKLY_API_AUTH_BASE_PATH
): Promise<InklyAuthSession | null> {
  const url = new URL(request.url)
  setSessionPathname(url, basePath)

  const response = await auth.handler(
    new Request(url, {
      method: 'GET',
      headers: request.headers
    })
  )

  if (!response.ok) return null
  const payload = (await response.json().catch(() => null)) as InklyAuthSession | null

  if (!payload?.session?.userId || !payload.user?.id) return null
  return payload
}

export function getAuthSession(auth: InklyAuth, request: Request) {
  if (auth.getSession) {
    return auth.getSession(request)
  }

  return getSessionFromHandler(auth, request)
}

export function createInklyAuth(options: CreateInklyAuthOptions): InklyAuth {
  const config = resolveInklyAuthConfig({
    env: options.env,
    fallbackSecret: options.fallbackSecret
  })

  for (const warning of config.warnings) {
    options.logger?.warn(warning)
  }

  const auth = betterAuth({
    basePath: config.basePath,
    secret: config.secret,
    database: drizzleAdapter(options.database.db, {
      provider: 'sqlite',
      schema,
      usePlural: true
    }),
    plugins: config.enableTestUtils ? [testUtils()] : undefined,
    socialProviders: config.google
      ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret
          }
        }
      : undefined
  })

  const inklyAuth: InklyAuth = {
    handler(request) {
      return auth.handler(request)
    },
    getSession(request) {
      return getSessionFromHandler(
        {
          handler: (sessionRequest) => auth.handler(sessionRequest)
        },
        request,
        config.basePath
      )
    }
  }

  if (!config.enableTestUtils) {
    return inklyAuth
  }

  return {
    ...inklyAuth,
    async createTestSession(input) {
      const email = input.email?.trim() || 'mock-user@inkly.test'
      const name = input.name?.trim() || 'Mock Inkly User'
      const image = input.image ?? null
      const context = (await auth.$context) as typeof auth.$context extends Promise<infer T>
        ? T & BetterAuthTestContext
        : BetterAuthTestContext

      const existingUser = await options.database.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get()
      const savedUser =
        existingUser ??
        (await context.test.saveUser(
          context.test.createUser({
            email,
            name,
            image
          })
        ))

      const login = await context.test.login({ userId: savedUser.id })

      return {
        session: {
          id: login.session.id,
          token: login.session.token,
          userId: login.session.userId,
          expiresAt: login.session.expiresAt.toISOString(),
          createdAt: login.session.createdAt.toISOString(),
          updatedAt: login.session.updatedAt.toISOString()
        },
        user: {
          id: login.user.id,
          name: login.user.name,
          email: login.user.email,
          emailVerified: login.user.emailVerified,
          image: login.user.image ?? null,
          createdAt: login.user.createdAt.toISOString(),
          updatedAt: login.user.updatedAt.toISOString()
        },
        setCookieHeaders: login.cookies.map((cookie: (typeof login.cookies)[number]) =>
          serializeTestCookie(cookie, login.session.expiresAt.getTime())
        )
      }
    }
  }
}
