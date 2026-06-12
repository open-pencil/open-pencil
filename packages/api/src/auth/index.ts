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

export interface InklyAuthSignUpInput {
  email: string
  password: string
  name: string
}

export interface InklyAuthSignInInput {
  email: string
  password: string
}

export interface InklyAuthCredentialResult {
  userId: string
  email: string
  name: string
  setCookieHeader: string | null
}

export interface InklyAuth {
  handler(request: Request): Promise<Response>
  getSession?(request: Request): Promise<InklyAuthSession | null>
  createTestSession?(input: InklyAuthTestSessionInput): Promise<InklyAuthTestSession>
  signUpWithEmail?(input: InklyAuthSignUpInput): Promise<InklyAuthCredentialResult>
  signInWithEmail?(input: InklyAuthSignInInput): Promise<InklyAuthCredentialResult>
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

function resolveTrustedOrigin(): { host: string | null; proto: 'http' | 'https' } {
  try {
    const baseURL = process.env.INKLY_API_BETTER_AUTH_BASE_URL
    if (baseURL) {
      const u = new URL(baseURL)
      return { host: u.host, proto: u.protocol === 'http:' ? 'http' : 'https' }
    }
  } catch {
    // 不正な baseURL は無視
  }
  return { host: null, proto: 'https' }
}

async function getSessionFromHandler(
  auth: Pick<InklyAuth, 'handler'>,
  request: Request,
  basePath = INKLY_API_AUTH_BASE_PATH
): Promise<InklyAuthSession | null> {
  // Fly proxy 経由のリクエストは url が `http://0.0.0.0:3001/...` (内部 listen)
  // となり better-auth の cookie domain / baseURL 整合 check で fail する。
  // x-forwarded-host / proto から公開 origin を再構築して url を作り直す。
  //
  // セキュリティ: x-forwarded-host は信頼できない外部ヘッダのため、
  //   - `,` 区切りなら最初の値だけを使用
  //   - protocol は `http`/`https` のみ許可
  //   - trustedOrigin (baseURL から導出) と一致するときだけ rewrite する
  const trusted = resolveTrustedOrigin()
  const rawForwardedHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const rawForwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = rawForwardedHost?.split(',')[0]?.trim() ?? null
  const forwardedProtoCandidate = (rawForwardedProto?.split(',')[0]?.trim() ?? trusted.proto).toLowerCase()
  const forwardedProto: 'http' | 'https' =
    forwardedProtoCandidate === 'http' ? 'http' : forwardedProtoCandidate === 'https' ? 'https' : trusted.proto

  const original = new URL(request.url)
  const useForwarded =
    forwardedHost !== null && trusted.host !== null && forwardedHost === trusted.host
  const base = useForwarded
    ? `${forwardedProto}://${forwardedHost}`
    : `${original.protocol}//${original.host}`
  const url = new URL(original.pathname + original.search, base)
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

  const isProductionURL = config.baseURL.startsWith('https://')
  const auth = betterAuth({
    basePath: config.basePath,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(options.database.db, {
      provider: 'sqlite',
      schema,
      usePlural: true
    }),
    plugins: config.enableTestUtils ? [testUtils()] : undefined,
    // 招待 URL 経由で email+password sign-in できるよう emailAndPassword provider を有効化。
    // 公開 sign-up は open のまま (auth.api.signUpEmail を redeem 経路から内部呼び出しするため、
    // disableSignUp: true だと redeem endpoint からも弾かれる)。
    // sign-up しただけでは board は見えず、 必ず招待 token の検証 + collaborator 化を経由する必要が
    // あるため、 sign-up を公開しても「招待された人だけが board を見れる」 制約は別レイヤーで守られる。
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128
    },
    account: {
      // Cookie ベースの state 検証を skip し DB ベースの state mismatch check
      // (verifications.identifier 照合) だけで CSRF 防御する。 Fly proxy + Bun の
      // 組み合わせで __Secure- cookie が一部経路で消える問題に対する暫定回避策。
      // CSRF 防御は URL state + DB lookup で実質担保される (state は ID として
      // 推測困難、 DB lookup 失敗で reject される)。
      // better-auth 1.6 の context/create-context.mjs L130 で
      // `options.account?.skipStateCookieCheck` が読まれる、 socialProviders.google
      // の中ではなくここに置くのが正しい (initial 試行で provider 内に置いたら無視された)。
      skipStateCookieCheck: true
    },
    advanced: {
      // `__Secure-` prefix と `__Host-` prefix の自動付与は host-only cookie の
      // 制約が厳しく Fly.io の cross-machine routing で fail することを確認。
      // useSecureCookies を false にして prefix なしの通常 cookie で運用する。
      // Secure 属性自体は defaultCookieAttributes.secure で個別に true 化できる
      // ため、 HTTPS 通信での secrecy は維持される。
      useSecureCookies: false,
      defaultCookieAttributes: {
        // production HTTPS でも SameSite=Lax を使う。 Lax は top-level navigation
        // で送られるので OAuth callback (Google → 自サイトの GET) で確実に乗る。
        // None だと CSRF 攻撃面が広がり、 prefix 無しでは Secure も付かないため
        // 安全側に Lax で運用 (state パラメータの DB lookup で CSRF 防御は別途)。
        sameSite: 'lax',
        secure: isProductionURL,
        httpOnly: true,
        path: '/'
      }
    },
    socialProviders: config.google
      ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
            // prompt=consent で Google に毎回 consent 画面を出させ silent re-auth
            // (prompt=none で iframe 経由になり SameSite=Lax cookie が送られない問題)
            // を完全に回避する。 select_account だと Google が「同じユーザーで再認証」
            // を判断して silent flow に倒すケースがあり、 consent はそれを禁止する。
            // 副作用: scope の同意も毎回求められる (UX 1 step 増だが OAuth flow の
            // 安定性を優先)。
            prompt: 'consent',
            // Google OAuth の profile レスポンスから picture URL を image にマッピング
            mapProfileToUser: (profile) => ({
              name: profile.name,
              email: profile.email,
              image: profile.picture ?? null,
              emailVerified: profile.email_verified ?? false
            })
          }
        }
      : undefined
  })

  async function callBetterAuthCredentials(
    endpoint: '/sign-up/email' | '/sign-in/email',
    body: Record<string, string>
  ): Promise<InklyAuthCredentialResult> {
    const url = new URL(config.baseURL.replace(/\/$/, '') + config.basePath + endpoint)
    const request = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const response = await auth.handler(request)
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`better-auth ${endpoint} failed: ${response.status} ${text}`)
    }
    const data = (await response.json().catch(() => ({}))) as {
      user?: { id?: string; email?: string; name?: string }
    }
    const userId = data.user?.id
    const email = data.user?.email
    const name = data.user?.name
    if (!userId || !email || !name) {
      throw new Error(`better-auth ${endpoint} returned malformed response`)
    }
    return {
      userId,
      email,
      name,
      setCookieHeader: response.headers.get('set-cookie')
    }
  }

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
    },
    async signUpWithEmail(input) {
      return callBetterAuthCredentials('/sign-up/email', {
        email: input.email,
        password: input.password,
        name: input.name
      })
    },
    async signInWithEmail(input) {
      return callBetterAuthCredentials('/sign-in/email', {
        email: input.email,
        password: input.password
      })
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
