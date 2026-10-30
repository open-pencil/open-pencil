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

  test('counts pings per day by the network and wording Cloudflare reports, never the address', async () => {
    const huawei = { asn: 136907, asOrganization: 'Huawei Cloud Singapore Region' }
    await service.postJSON('/ping', BUILD, { 'CF-Connecting-IP': '203.0.113.7' }, huawei)
    await service.postJSON('/ping', BUILD, {}, huawei)
    await service.postJSON('/ping', BUILD, {}, { ...huawei, asOrganization: 'Huawei-Cloud-SG' })
    await service.postJSON('/ping', { ...BUILD, app: 'web' }, {}, { asn: 9299 })

    const networks = await createFeedbackDatabase(service.db)
      .selectFrom('pingNetworks')
      .selectAll()
      .where('asn', '!=', 0)
      .orderBy(['asn', 'app', 'name'])
      .execute()
    expect(networks).toEqual([
      { day: '2026-10-12', asn: 9299, app: 'web', platform: 'macos', name: '', count: 1 },
      {
        day: '2026-10-12',
        asn: 136907,
        app: 'desktop',
        platform: 'macos',
        name: 'Huawei Cloud Singapore Region',
        count: 2
      },
      {
        day: '2026-10-12',
        asn: 136907,
        app: 'desktop',
        platform: 'macos',
        name: 'Huawei-Cloud-SG',
        count: 1
      }
    ])
    expect(JSON.stringify(networks)).not.toContain('203.0.113.7')
  })

  test('counts a ping without network details under AS 0', async () => {
    await service.postJSON('/ping', { ...BUILD, platform: 'linux' })

    const unknown = await createFeedbackDatabase(service.db)
      .selectFrom('pingNetworks')
      .select(['asn', 'name', 'count'])
      .where('platform', '=', 'linux')
      .execute()
    expect(unknown).toEqual([{ asn: 0, name: '', count: 1 }])
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
