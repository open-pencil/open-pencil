import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createFeedbackApp, type FeedbackServices } from '#feedback/app'
import { maxBy } from 'es-toolkit'
import { testClient } from 'hono/testing'
import { getPlatformProxy } from 'wrangler'

const PACKAGE_ROOT = join(import.meta.dir, '..')

export interface FetchCall {
  url: string
  init: RequestInit | undefined
}

/** A rate limiter that allows requests until `exhausted` is set. */
export function testLimiter(): RateLimit & { exhausted: boolean } {
  return {
    exhausted: false,
    async limit() {
      return { success: !this.exhausted }
    }
  }
}

async function applyMigrations(db: D1Database): Promise<void> {
  const directory = join(PACKAGE_ROOT, 'migrations')
  for (const file of (await readdir(directory)).toSorted()) {
    const sql = (await readFile(join(directory, file), 'utf8'))
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    const statements = sql
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0)
    await db.batch(statements.map((statement) => db.prepare(statement)))
  }
}

/**
 * The service against a local D1 from Miniflare, migrated from `migrations/`, with outside
 * calls, email, rate limits, and the clock replaced so each test can steer and inspect them.
 */
export async function createTestService() {
  const proxy = await getPlatformProxy<Env>({
    configPath: join(PACKAGE_ROOT, 'wrangler.jsonc'),
    persist: false
  })
  await applyMigrations(proxy.env.DB)

  const fetchCalls: FetchCall[] = []
  const responses = new Map<string, (call: FetchCall) => Response>()
  const sentEmails: EmailMessageBuilder[] = []
  let now = new Date('2026-10-12T09:00:00.000Z')
  const limiters = { ping: testLimiter(), ingest: testLimiter(), waitlist: testLimiter() }

  const env: Env = {
    ...proxy.env,
    POSTHOG_HOST: 'https://eu.i.posthog.com',
    POSTHOG_KEY: 'phc_test',
    TURNSTILE_SECRET: 'turnstile-secret',
    TURNSTILE_HOSTNAMES: 'openpencil.dev,app.openpencil.dev',
    EMAIL_FROM: 'hello@openpencil.dev',
    GITHUB_TOKEN: 'github-token',
    CLOUDFLARE_ANALYTICS_TOKEN: 'cloudflare-token',
    ACCESS_TEAM_DOMAIN: 'https://openpencil.cloudflareaccess.com',
    ACCESS_AUD: 'admin-audience',
    POSTHOG_PERSONAL_KEY: 'phx_test',
    // The built dashboard page as the asset binding serves it, at its file path only.
    ASSETS: {
      async fetch(input: RequestInfo | URL) {
        const { pathname } = new URL(input instanceof Request ? input.url : String(input))
        if (pathname === '/admin/metrics.html')
          return new Response('<!doctype html><title>Metrics</title>', {
            headers: { 'Content-Type': 'text/html' }
          })
        return new Response(null, { status: 404 })
      },
      connect() {
        throw new Error('The test asset binding has no sockets')
      }
    },
    PING_LIMITER: limiters.ping,
    INGEST_LIMITER: limiters.ingest,
    WAITLIST_LIMITER: limiters.waitlist,
    EMAIL: {
      async send(message: EmailMessageBuilder | EmailMessage) {
        if (!('subject' in message)) throw new Error('Tests send composed emails only')
        sentEmails.push(message)
        return { messageId: `message-${sentEmails.length}` }
      }
    }
  }

  const services: FeedbackServices = {
    async fetch(input, init) {
      const url = input instanceof Request ? input.url : String(input)
      const call = { url, init }
      fetchCalls.push(call)
      // The most specific prefix answers, so a repository's own URL does not shadow its subpaths.
      const match = maxBy(
        [...responses].filter(([prefix]) => url.startsWith(prefix)),
        ([prefix]) => prefix.length
      )
      return match ? match[1](call) : new Response(null, { status: 200 })
    },
    now: () => now
  }
  const app = createFeedbackApp(services)

  /**
   * Sends a request into the app, carrying `cf` as Cloudflare attaches it when given. A text body
   * gets its Content-Length, as browsers send it; without one, the body limit rebuilds the request.
   */
  const request = (path: string, init?: RequestInit, cf?: Record<string, unknown>) => {
    const headers = new Headers(init?.headers)
    if (typeof init?.body === 'string')
      headers.set('Content-Length', String(new TextEncoder().encode(init.body).length))
    const sent = new Request(`https://feedback.openpencil.dev${path}`, { ...init, headers })
    if (cf) Object.defineProperty(sent, 'cf', { value: cf })
    return app.request(sent, undefined, env)
  }

  return {
    /** A client typed by the service's routes, as the app's is, sending into the app under test. */
    client: testClient(app, env),
    env,
    /** The outside world the app and the cron jobs see. */
    services,
    limiters,
    db: proxy.env.DB,
    fetchCalls,
    sentEmails,
    /** Forgets every answer registered with `respond`, so one test's answers do not reach the next. */
    clearResponses() {
      responses.clear()
    },
    /** Answers outside requests whose URL starts with `prefix`; the longest matching prefix wins. */
    respond(prefix: string, response: (call: FetchCall) => Response) {
      responses.set(prefix, response)
    },
    setNow(date: Date) {
      now = date
    },
    request,
    /** Posts any body, including ones the typed client would not let through. */
    postJSON(
      path: string,
      body: unknown,
      headers: Record<string, string> = {},
      cf?: Record<string, unknown>
    ) {
      return request(
        path,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body)
        },
        cf
      )
    },
    dispose: () => proxy.dispose()
  }
}

export type TestService = Awaited<ReturnType<typeof createTestService>>
