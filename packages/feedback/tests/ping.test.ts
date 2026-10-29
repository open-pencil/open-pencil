import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { createTestService, type TestService } from '#feedback-tests/harness'
import type { Ping } from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import { omit } from 'es-toolkit'

const BUILD: Ping = {
  version: '0.16.0',
  platform: 'macos',
  arch: 'arm64',
  app: 'desktop',
  browser: 'unknown',
  usageStats: 'unset'
}

let service: TestService

beforeAll(async () => {
  service = await createTestService()
})

afterAll(async () => {
  await service.dispose()
})

function counts() {
  return createFeedbackDatabase(service.db)
    .selectFrom('usagePings')
    .select(['day', 'version', 'platform', 'app', 'usageStats', 'count'])
    .orderBy(['version', 'usageStats'])
    .execute()
}

describe('ping', () => {
  test('counts pings per day and build, never per install', async () => {
    expect((await service.client.ping.$post({ json: BUILD })).status).toBe(204)
    expect((await service.client.ping.$post({ json: BUILD })).status).toBe(204)
    expect(
      (await service.client.ping.$post({ json: { ...BUILD, version: '0.15.1' } })).status
    ).toBe(204)

    expect(await counts()).toEqual([
      {
        day: '2026-10-12',
        version: '0.15.1',
        platform: 'macos',
        app: 'desktop',
        usageStats: 'unset',
        count: 1
      },
      {
        day: '2026-10-12',
        version: '0.16.0',
        platform: 'macos',
        app: 'desktop',
        usageStats: 'unset',
        count: 2
      }
    ])
  })

  test('counts installs that declined usage stats apart from those that share them', async () => {
    await service.postJSON('/ping', { ...BUILD, version: '0.17.0', usageStats: 'denied' })
    await service.postJSON('/ping', { ...BUILD, version: '0.17.0', usageStats: 'granted' })
    await service.postJSON('/ping', { ...BUILD, version: '0.17.0', usageStats: 'granted' })

    const answers = (await counts()).filter((row) => row.version === '0.17.0')
    expect(answers.map(({ usageStats, count }) => ({ usageStats, count }))).toEqual([
      { usageStats: 'denied', count: 1 },
      { usageStats: 'granted', count: 2 }
    ])
  })

  test('refuses a ping without the usage stats answer', async () => {
    expect((await service.postJSON('/ping', omit(BUILD, ['usageStats']))).status).toBe(400)
  })

  test('refuses a ping carrying anything beyond the build', async () => {
    const before = await counts()
    const response = await service.postJSON('/ping', { ...BUILD, installId: 'a'.repeat(32) })

    expect(response.status).toBe(400)
    expect(await counts()).toEqual(before)
  })

  test('refuses pings over the rate limit', async () => {
    service.limiters.ping.exhausted = true
    try {
      expect((await service.postJSON('/ping', BUILD)).status).toBe(429)
    } finally {
      service.limiters.ping.exhausted = false
    }
  })

  test('answers the desktop and web apps across origins', async () => {
    const response = await service.request('/ping', {
      method: 'OPTIONS',
      headers: {
        Origin: 'tauri://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    })

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('tauri://localhost')
  })
})
