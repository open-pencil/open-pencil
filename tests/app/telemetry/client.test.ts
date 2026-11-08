import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import type { Build } from '@open-pencil/feedback/contract'

import { createDeferred } from '@/app/runtime/deferred'
import type { SharingPreferences } from '@/app/settings/preferences/store'
import { createSharingClient, type SharingClientOptions } from '@/app/telemetry/client'
import type { SharingState } from '@/app/telemetry/state'

const BUILD: Build = {
  version: '0.16.0',
  platform: 'linux',
  arch: 'x64',
  app: 'desktop',
  browser: 'unknown'
}
const INSTALL_ID = '0123456789abcdef0123456789abcdef'

function setup(overrides: Partial<SharingClientOptions> = {}) {
  const posts: { route: string; body: unknown; keepalive?: boolean }[] = []
  const preferences = ref<SharingPreferences>({ dailyPing: true, usageStats: 'unset' })
  const state = ref<SharingState>({ installId: null, lastPingDay: null, pingDays: 0 })
  const clock = { now: new Date('2026-10-12T09:00:00.000Z') }
  let accept = true
  const client = createSharingClient({
    enabled: true,
    preferences: () => preferences.value,
    state,
    build: async () => BUILD,
    disabledByEnvironment: async () => false,
    send: {
      async ping(body) {
        posts.push({ route: '/ping', body, keepalive: undefined })
        return accept
      },
      async ingest(body, { keepalive }) {
        posts.push({ route: '/ingest', body, keepalive })
        return accept
      }
    },
    now: () => clock.now,
    ...overrides
  })
  return {
    client,
    posts,
    preferences,
    state,
    clock,
    rejectPosts: () => {
      accept = false
    },
    acceptPosts: () => {
      accept = true
    }
  }
}

function sharingUsage(context: ReturnType<typeof setup>) {
  context.preferences.value = { ...context.preferences.value, usageStats: 'granted' }
  context.state.value = { ...context.state.value, installId: INSTALL_ID }
}

describe('daily ping', () => {
  test('sends only the build and the step of its days, once a day', async () => {
    const context = setup()

    await context.client.sendDailyPing()
    await context.client.sendDailyPing()
    context.clock.now = new Date('2026-10-13T01:00:00.000Z')
    await context.client.sendDailyPing()

    const ping = { ...BUILD, usageStats: 'unset' }
    expect(context.posts).toEqual([
      {
        route: '/ping',
        body: { ...ping, pingDays: '1', enteredStep: true },
        keepalive: undefined
      },
      {
        route: '/ping',
        body: { ...ping, pingDays: '2', enteredStep: true },
        keepalive: undefined
      }
    ])
    expect(context.state.value).toMatchObject({ lastPingDay: '2026-10-13', pingDays: 2 })
  })

  test('reports a step, never the exact number of days', async () => {
    const context = setup()
    context.state.value = { ...context.state.value, lastPingDay: '2026-10-11', pingDays: 146 }
    await context.client.sendDailyPing()

    expect(context.posts.map((post) => post.body)).toEqual([
      { ...BUILD, usageStats: 'unset', pingDays: '65+', enteredStep: false }
    ])
    expect(context.state.value.pingDays).toBe(147)
  })

  test('reports how the install answered the usage stats question', async () => {
    const context = setup()
    context.preferences.value = { ...context.preferences.value, usageStats: 'denied' }
    await context.client.sendDailyPing()

    expect(context.posts).toEqual([
      {
        route: '/ping',
        body: { ...BUILD, usageStats: 'denied', pingDays: '1', enteredStep: true },
        keepalive: undefined
      }
    ])
  })

  test('tries again on the next check when a ping fails', async () => {
    const context = setup()
    context.rejectPosts()
    await context.client.sendDailyPing()
    expect(context.state.value).toMatchObject({ lastPingDay: null, pingDays: 0 })

    context.acceptPosts()
    await context.client.sendDailyPing()
    expect(context.posts.map((post) => post.body)).toEqual([
      { ...BUILD, usageStats: 'unset', pingDays: '1', enteredStep: true },
      { ...BUILD, usageStats: 'unset', pingDays: '1', enteredStep: true }
    ])
    expect(context.state.value).toMatchObject({ lastPingDay: '2026-10-12', pingDays: 1 })
  })

  test('a check while a ping is pending waits for it instead of sending another', async () => {
    const sent = createDeferred<boolean>()
    let pings = 0
    const context = setup({
      send: {
        ping: () => {
          pings++
          return sent.promise
        },
        ingest: async () => true
      }
    })

    const first = context.client.sendDailyPing()
    const second = context.client.sendDailyPing()
    sent.resolve(true)
    await Promise.all([first, second])
    await context.client.sendDailyPing()

    expect(pings).toBe(1)
    expect(context.state.value).toMatchObject({ lastPingDay: '2026-10-12', pingDays: 1 })
  })

  test('sends no ping when it is turned off while the build is being read', async () => {
    const build = createDeferred<Build>()
    const context = setup({ build: () => build.promise })
    const pinging = context.client.sendDailyPing()
    await Promise.resolve()
    context.preferences.value = { ...context.preferences.value, dailyPing: false }
    build.resolve(BUILD)
    await pinging

    expect(context.posts).toEqual([])
  })

  test('sends nothing when turned off, from a build that may not send, or when the environment says so', async () => {
    const off = setup()
    off.preferences.value = { ...off.preferences.value, dailyPing: false }
    await off.client.sendDailyPing()

    const unofficial = setup({ enabled: false })
    await unofficial.client.sendDailyPing()

    const environment = setup({ disabledByEnvironment: async () => true })
    await environment.client.sendDailyPing()

    expect([...off.posts, ...unofficial.posts, ...environment.posts]).toEqual([])
  })
})

describe('usage stats', () => {
  test('records nothing until the person agrees', async () => {
    const context = setup()
    context.client.trackUsage({ name: 'app_opened', locale: 'en' })
    sharingUsage(context)
    await context.client.flushUsage()

    expect(context.posts).toEqual([])
  })

  test('sends recorded events with the build and the random install ID', async () => {
    const context = setup()
    sharingUsage(context)
    context.client.trackUsage({ name: 'app_opened', locale: 'fr' })
    context.client.trackDocumentFormat('document_exported', 'svg')
    await context.client.flushUsage({ keepalive: true })

    expect(context.posts).toEqual([
      {
        route: '/ingest',
        keepalive: true,
        body: {
          ...BUILD,
          installId: INSTALL_ID,
          events: [
            { name: 'app_opened', locale: 'fr', timestamp: '2026-10-12T09:00:00.000Z' },
            { name: 'document_exported', format: 'svg', timestamp: '2026-10-12T09:00:00.000Z' }
          ]
        }
      }
    ])
  })

  test('leaves out file formats that are not on the shared list', async () => {
    const context = setup()
    sharingUsage(context)
    context.client.trackDocumentFormat('document_opened', 'sketch')
    await context.client.flushUsage()

    expect(context.posts).toEqual([])
  })

  test('sends long queues in batches the service accepts', async () => {
    const context = setup()
    sharingUsage(context)
    for (let index = 0; index < 120; index += 1) {
      context.client.trackUsage({ name: 'document_opened', format: 'fig' })
    }
    await context.client.flushUsage()

    expect(
      context.posts.map(({ body }) =>
        typeof body === 'object' && body !== null && 'events' in body && Array.isArray(body.events)
          ? body.events.length
          : 0
      )
    ).toEqual([50, 50, 20])
  })

  test('sends nothing when the person stops sharing while a batch is being prepared', async () => {
    const build = createDeferred<Build>()
    const context = setup({ build: () => build.promise })
    sharingUsage(context)
    context.client.trackUsage({ name: 'app_opened', locale: 'en' })
    const flushing = context.client.flushUsage()
    await Promise.resolve()
    context.preferences.value = { ...context.preferences.value, usageStats: 'denied' }
    build.resolve(BUILD)
    await flushing

    expect(context.posts).toEqual([])
  })

  test('drops what is queued when the person stops sharing before it is sent', async () => {
    const context = setup()
    sharingUsage(context)
    context.client.trackUsage({ name: 'app_opened', locale: 'en' })
    context.preferences.value = { ...context.preferences.value, usageStats: 'denied' }
    await context.client.flushUsage()

    context.preferences.value = { ...context.preferences.value, usageStats: 'granted' }
    await context.client.flushUsage()

    expect(context.posts).toEqual([])
  })
})
