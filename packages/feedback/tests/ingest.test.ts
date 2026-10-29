import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createTestService, type TestService } from '#feedback-tests/harness'
import type { UsageBatch } from '#feedback/contract'
import * as v from 'valibot'

const BATCH: UsageBatch = {
  version: '0.16.0',
  platform: 'windows',
  arch: 'x64',
  app: 'desktop',
  browser: 'unknown',
  installId: '0123456789abcdef0123456789abcdef',
  events: [
    { name: 'app_opened', timestamp: '2026-10-12T09:00:00.000Z', locale: 'de' },
    { name: 'document_opened', timestamp: '2026-10-12T09:01:00.000Z', format: 'fig' }
  ]
}

const postHogBodySchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    api_key: v.string(),
    batch: v.array(
      v.object({
        event: v.string(),
        timestamp: v.string(),
        distinct_id: v.string(),
        properties: v.record(v.string(), v.unknown())
      })
    )
  })
)

let service: TestService

beforeAll(async () => {
  service = await createTestService()
})

beforeEach(() => {
  service.fetchCalls.length = 0
})

afterAll(async () => {
  await service.dispose()
})

describe('ingest', () => {
  test('forwards listed events to PostHog without person profiles or GeoIP', async () => {
    const response = await service.client.ingest.$post(
      { json: BATCH },
      { headers: { 'CF-Connecting-IP': '203.0.113.7' } }
    )

    expect(response.status).toBe(204)
    expect(service.fetchCalls).toHaveLength(1)
    const [call] = service.fetchCalls
    expect(call.url).toBe('https://eu.i.posthog.com/batch/')
    expect(call.init?.headers).toEqual({ 'Content-Type': 'application/json' })
    const body = v.parse(postHogBodySchema, call.init?.body)
    expect(body.api_key).toBe('phc_test')
    expect(body.batch).toEqual([
      {
        event: 'app_opened',
        timestamp: '2026-10-12T09:00:00.000Z',
        distinct_id: BATCH.installId,
        properties: {
          locale: 'de',
          version: '0.16.0',
          platform: 'windows',
          arch: 'x64',
          app: 'desktop',
          browser: 'unknown',
          $lib: 'openpencil',
          $process_person_profile: false,
          $geoip_disable: true
        }
      },
      {
        event: 'document_opened',
        timestamp: '2026-10-12T09:01:00.000Z',
        distinct_id: BATCH.installId,
        properties: {
          format: 'fig',
          version: '0.16.0',
          platform: 'windows',
          arch: 'x64',
          app: 'desktop',
          browser: 'unknown',
          $lib: 'openpencil',
          $process_person_profile: false,
          $geoip_disable: true
        }
      }
    ])
    expect(JSON.stringify(body)).not.toContain('203.0.113.7')
  })

  test('refuses events that are not on the list', async () => {
    const response = await service.postJSON('/ingest', {
      ...BATCH,
      events: [{ name: 'layer_renamed', timestamp: '2026-10-12T09:00:00.000Z' }]
    })

    expect(response.status).toBe(400)
    expect(service.fetchCalls).toHaveLength(0)
  })

  test('refuses listed events carrying extra properties', async () => {
    const response = await service.postJSON('/ingest', {
      ...BATCH,
      events: [
        {
          name: 'document_opened',
          timestamp: '2026-10-12T09:00:00.000Z',
          format: 'fig',
          fileName: 'Client roadmap.fig'
        }
      ]
    })

    expect(response.status).toBe(400)
    expect(service.fetchCalls).toHaveLength(0)
  })

  test('refuses a property value outside its list', async () => {
    const response = await service.postJSON('/ingest', {
      ...BATCH,
      events: [{ name: 'document_opened', timestamp: '2026-10-12T09:00:00.000Z', format: 'sketch' }]
    })

    expect(response.status).toBe(400)
  })

  test('reports an unreachable PostHog as an upstream failure', async () => {
    service.respond('https://eu.i.posthog.com/', () => {
      throw new TypeError('Network connection lost')
    })

    expect((await service.postJSON('/ingest', BATCH)).status).toBe(502)
  })

  test('reports a PostHog failure to the client', async () => {
    service.respond('https://eu.i.posthog.com/', () => new Response(null, { status: 503 }))

    expect((await service.postJSON('/ingest', BATCH)).status).toBe(502)
  })
})
