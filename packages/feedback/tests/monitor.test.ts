import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createTestService, type FetchCall, type TestService } from '#feedback-tests/harness'
import { runMonitor } from '#feedback/monitor'
import * as v from 'valibot'

let service: TestService

const CLOUD = 'https://cloud.openpencil.dev/health'
const TELEGRAM = 'https://api.telegram.org/bottelegram-token'
const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'
const OPENROUTER = 'https://openrouter.ai/api/v1'
/** A minute that runs only the uptime checks. */
const MINUTE = new Date('2026-11-19T10:01:00.000Z')

const sentSchema = v.object({
  chat_id: v.string(),
  rich_message: v.optional(v.object({ html: v.string() })),
  text: v.optional(v.string())
})

/** What the channel was sent, oldest first, as rich HTML or the plain fallback. */
function posts(): string[] {
  return service.fetchCalls
    .filter((call) => call.url.startsWith(TELEGRAM))
    .map((call) => {
      const body = v.parse(v.pipe(v.string(), v.parseJson(), sentSchema), call.init?.body)
      return body.rich_message?.html ?? body.text ?? ''
    })
}

async function run(at: Date) {
  service.setNow(at)
  await runMonitor(service.env, service.services, at)
}

const minutesAfter = (minutes: number, from = MINUTE) => new Date(from.getTime() + minutes * 60_000)

/** Workers analytics with no traffic, for runs that cross a five-minute check. */
const quietWorkers = () =>
  json({ data: { viewer: { accounts: [{ invocations: [], failed: [] }] } } })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

beforeAll(async () => {
  service = await createTestService()
})

afterAll(() => service.dispose())

beforeEach(async () => {
  service.clearResponses()
  service.fetchCalls.length = 0
  await service.db.exec('DELETE FROM monitor_state')
})

describe('uptime', () => {
  beforeEach(() => {
    service.respond(GRAPHQL, quietWorkers)
  })

  test('posts once after three failed runs, and once when it is back', async () => {
    service.respond(CLOUD, () => new Response(null, { status: 503 }))
    await run(MINUTE)
    await run(minutesAfter(1))
    expect(posts()).toEqual([])
    await run(minutesAfter(2))
    await run(minutesAfter(3))
    expect(posts()).toHaveLength(1)
    expect(posts()[0]).toContain('cloud.openpencil.dev is down')
    expect(posts()[0]).toContain('HTTP 503')

    service.respond(CLOUD, () => new Response('{"status":"ok"}'))
    for (const minute of [4, 5, 6, 7]) await run(minutesAfter(minute))
    expect(posts()).toHaveLength(2)
    expect(posts()[1]).toContain('cloud.openpencil.dev is back up')
    expect(posts()[1]).toContain('<td>Lasted</td><td><code>4 min</code>')
  })

  test('a single failed run between good ones posts nothing', async () => {
    service.respond(CLOUD, () => new Response('ok'))
    await run(MINUTE)
    service.respond(CLOUD, () => new Response(null, { status: 502 }))
    await run(minutesAfter(1))
    service.respond(CLOUD, () => new Response('ok'))
    await run(minutesAfter(2))
    expect(posts()).toEqual([])
  })

  test('reminds once a day while still down', async () => {
    service.respond(CLOUD, () => new Response(null, { status: 500 }))
    for (const minute of [0, 1, 2]) await run(minutesAfter(minute))
    await run(minutesAfter(60))
    expect(posts()).toHaveLength(1)
    await run(minutesAfter(2 + 24 * 60))
    expect(posts()).toHaveLength(2)
  })

  test('falls back to plain text when Telegram refuses the rich message', async () => {
    service.respond(CLOUD, () => new Response(null, { status: 500 }))
    service.respond(`${TELEGRAM}/sendRichMessage`, () => json({ ok: false }, 400))
    for (const minute of [0, 1, 2]) await run(minutesAfter(minute))
    const sent = service.fetchCalls.filter((call: FetchCall) => call.url.startsWith(TELEGRAM))
    expect(sent.map((call) => call.url.slice(TELEGRAM.length))).toEqual([
      '/sendRichMessage',
      '/sendMessage'
    ])
    expect(posts()[1]).toStartWith('🔴 cloud.openpencil.dev is down · uptime')
  })

  test('escapes what a check reports', async () => {
    service.respond(CLOUD, () => {
      throw new Error('<b>refused</b> & closed')
    })
    for (const minute of [0, 1, 2]) await run(minutesAfter(minute))
    expect(posts()[0]).toContain('&lt;b&gt;refused&lt;/b&gt; &amp; closed')
  })
})

describe('OpenRouter', () => {
  const QUARTER = new Date('2026-11-19T10:15:00.000Z')

  beforeEach(() => {
    service.respond(CLOUD, () => new Response('ok'))
    service.respond(GRAPHQL, quietWorkers)
  })

  const key = (remaining: number | null) =>
    json({
      data: {
        label: 'cloud',
        limit: remaining === null ? null : 100,
        limit_remaining: remaining,
        limit_reset: 'monthly',
        usage_daily: 3,
        usage_monthly: 40
      }
    })

  test('warns, then alerts, as the key nears its cap, and says when it has room', async () => {
    service.respond(`${OPENROUTER}/key`, () => key(20))
    await run(QUARTER)
    expect(posts()).toHaveLength(1)
    expect(posts()[0]).toStartWith('<p>🟠 <b>OpenRouter key cloud is near its spending cap</b>')
    expect(posts()[0]).toContain('<td>Left</td><td><code>$20.00</code>')

    service.respond(`${OPENROUTER}/key`, () => key(3))
    await run(minutesAfter(15, QUARTER))
    expect(posts()[1]).toStartWith('<p>🔴 ')

    service.respond(`${OPENROUTER}/key`, () => key(80))
    await run(minutesAfter(30, QUARTER))
    expect(posts()[2]).toContain('OpenRouter key cloud has room again')
  })

  test('a key without a cap passes', async () => {
    service.respond(`${OPENROUTER}/key`, () => key(null))
    await run(QUARTER)
    expect(posts()).toEqual([])
  })

  test('reads the balance only with a management key', async () => {
    service.respond(`${OPENROUTER}/key`, () => key(80))
    service.respond(`${OPENROUTER}/credits`, () =>
      json({ data: { total_credits: 100, total_usage: 98 } })
    )
    await run(QUARTER)
    expect(service.fetchCalls.some((call) => call.url.endsWith('/credits'))).toBe(false)

    const env = { ...service.env, OPENROUTER_MANAGEMENT_KEY: 'management-key' }
    await runMonitor(env, service.services, minutesAfter(15, QUARTER))
    expect(posts()).toHaveLength(1)
    expect(posts()[0]).toContain('OpenRouter credits are running out')
    expect(posts()[0]).toContain('<td>Balance</td><td><code>$2.00</code>')
  })

  test('a check that cannot be read keeps its state and lets the others run', async () => {
    service.respond(`${OPENROUTER}/key`, () => new Response(null, { status: 502 }))
    await expect(run(QUARTER)).rejects.toThrow('OpenRouter answered /key with 502')
    const rows = await service.db.prepare('SELECT check_name FROM monitor_state').all()
    expect(rows.results.map((row) => row.check_name)).toContain(`uptime ${CLOUD}`)
    expect(rows.results.map((row) => row.check_name)).not.toContain('openrouter key')
  })
})

describe('Worker failures', () => {
  const FIVE = new Date('2026-11-19T10:05:00.000Z')
  // The bucket judged is the one that ended five minutes before the run.
  const LATEST = '2026-11-19T09:55:00Z'

  const bucket = (
    scriptName: string,
    datetimeFiveMinutes: string,
    requests: number,
    errors: number
  ) => ({
    sum: { requests, errors },
    dimensions: { scriptName, datetimeFiveMinutes }
  })

  beforeEach(() => {
    service.respond(CLOUD, () => new Response('ok'))
  })

  test('posts a spike against the hour before, and nothing for usual noise', async () => {
    service.respond(GRAPHQL, (call) => {
      const sent = String(call.init?.body)
      expect(sent).toContain('"start":"2026-11-19T08:55:00.000Z"')
      expect(sent).toContain('"end":"2026-11-19T10:00:00.000Z"')
      return json({
        data: {
          viewer: {
            accounts: [
              {
                invocations: [
                  bucket('openpencil-cloud', LATEST, 200, 4),
                  bucket('openpencil-cloud', '2026-11-19T09:30:00Z', 180, 1),
                  bucket('openpencil-services', LATEST, 50, 2)
                ],
                failed: [
                  {
                    sum: { requests: 30 },
                    dimensions: {
                      scriptName: 'openpencil-cloud',
                      datetimeFiveMinutes: LATEST
                    }
                  }
                ]
              }
            ]
          }
        }
      })
    })
    await run(FIVE)
    expect(posts()).toHaveLength(1)
    expect(posts()[0]).toStartWith('<p>🟠 <b>openpencil-cloud is failing more than usual</b>')
    expect(posts()[0]).toContain('<td>Failed in 5 min</td><td><code>34</code>')
  })

  test('more failures than successes is urgent', async () => {
    service.respond(GRAPHQL, () =>
      json({
        data: {
          viewer: {
            accounts: [
              {
                invocations: [bucket('openpencil-services', LATEST, 40, 30)],
                failed: []
              }
            ]
          }
        }
      })
    )
    await run(FIVE)
    expect(posts()[0]).toStartWith('<p>🔴 <b>openpencil-services is failing more than usual</b>')
  })
})

describe('Cloudflare notifications', () => {
  test('forward a signed notification', async () => {
    const response = await service.postJSON(
      '/monitor/cloudflare',
      {
        name: 'Workers incident',
        text: 'Elevated errors in Workers',
        alert_type: 'incident_alert'
      },
      { 'cf-webhook-auth': 'webhook-secret' }
    )
    expect(response.status).toBe(204)
    expect(posts()[0]).toStartWith('<p>☁️ <b>Workers incident</b> · Cloudflare</p>')
    expect(posts()[0]).toContain('<pre>Elevated errors in Workers</pre>')
  })

  test('refuse anything without the secret', async () => {
    const attempts: Record<string, string>[] = [{}, { 'cf-webhook-auth': 'wrong' }]
    for (const headers of attempts) {
      const response = await service.postJSON('/monitor/cloudflare', { name: 'x' }, headers)
      expect(response.status).toBe(401)
    }
    expect(posts()).toEqual([])
  })
})

describe('heartbeat', () => {
  const heartbeatSchema = v.strictObject({ lastRun: v.nullable(v.string()) })
  const heartbeat = async () => {
    const response = await service.request('/monitor/heartbeat')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    return v.parse(heartbeatSchema, await response.json()).lastRun
  }

  test('says when a check last ran, and nothing else', async () => {
    expect(await heartbeat()).toBeNull()
    service.respond(CLOUD, () => new Response('ok'))
    await run(MINUTE)
    expect(await heartbeat()).toBe(MINUTE.toISOString())
  })
})
