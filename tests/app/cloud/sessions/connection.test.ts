import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import * as v from 'valibot'
import { nextTick } from 'vue'

import { cloudLocaleUpdateSchema } from '@open-pencil/cloud/contract'
import { fetchStub } from '@open-pencil/test-support/fetch'
import { localeSetting } from '@open-pencil/vue/i18n'

import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import {
  checkedCloudConnection,
  cloudConnection,
  cloudConnections,
  forgetCloudConnection,
  recheckedCloudConnection,
  refreshCloudConnection
} from '@/app/cloud/sessions/connection'
import { watchCloudAccountSwitches } from '@/app/cloud/sessions/forget'
import {
  CLOUD_STORAGE_PROVIDER_ID,
  readCloudSessionToken,
  saveCloudSessionToken
} from '@/app/cloud/sessions/token'
import { clearRecentFiles, recentFiles, rememberRecentStorageDocument } from '@/app/recent-files'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'
const ORIGIN = 'https://cloud.example.com'
const user = { userId: 'user-1', email: 'ada@example.com', name: 'Ada' }
const workspace = {
  id: '6f1c6c1e-7a4d-4d1b-9a2e-1f0b6a3c2d10',
  name: 'Design',
  slug: 'design',
  role: 'editor',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

type Answer = { status: number; body?: unknown }
let answers: Record<string, Answer> = {}
let authorization: (string | null)[] = []
let statusRequests = 0
/** The languages the app told the server, in order. */
let locales: string[] = []
/** Runs while the server answers for its workspaces, as a check is under way. */
let duringCheck: (() => void) | undefined
/** Runs while the server answers who is signed in. */
let duringStatus: (() => Promise<void>) | undefined

beforeEach(() => {
  answers = {}
  authorization = []
  statusRequests = 0
  locales = []
  duringCheck = undefined
  duringStatus = undefined
  spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      authorization.push(new Headers(init?.headers).get('Authorization'))
      if (url.pathname === '/api/account/status') {
        statusRequests += 1
        await duringStatus?.()
      }
      if (url.pathname === '/api/workspaces') duringCheck?.()
      if (url.pathname === '/api/account/locale') {
        locales.push(
          v.parse(v.pipe(v.string(), v.parseJson(), cloudLocaleUpdateSchema), init?.body).locale
        )
        return Response.json({ ok: true })
      }
      if (url.pathname === '/.well-known/openpencil')
        return Response.json(cloudDiscoveryFixture(ORIGIN))
      const answer = answers[url.pathname]
      if (!answer) return new Response(null, { status: 404 })
      return Response.json(answer.body ?? { error: { code: 'unauthorized' } }, {
        status: answer.status
      })
    })
  )
})

afterEach(async () => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
  await clearRecentFiles()
  localeSetting.set(undefined)
})

async function server() {
  return addCloudServer({ kind: 'self-hosted', url: ORIGIN })
}

describe('Cloud connections', () => {
  test('list workspaces for an approved account and remember who it is', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    const connection = await refreshCloudConnection(target)
    expect(connection.state).toBe('signed-in')
    expect(connection.workspaces.map((entry) => entry.name)).toEqual(['Design'])
    expect(cloudServers.value[0]?.account).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      image: null
    })
  })

  test("forget the last account's recent documents once another signs in", async () => {
    await clearRecentFiles()
    const stop = watchCloudAccountSwitches()
    try {
      answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
      answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
      await refreshCloudConnection(await server())
      const [target] = cloudServers.value
      if (!target) throw new Error('No server')
      rememberRecentStorageDocument(
        { providerId: CLOUD_STORAGE_PROVIDER_ID, profileId: target.id, documentId: 'doc-1' },
        "Ada's design",
        'design'
      )

      await refreshCloudConnection(target)
      expect(recentFiles.value.map(({ name }) => name)).toEqual(["Ada's design"])

      answers['/api/account/status'] = {
        status: 200,
        body: { user: { ...user, userId: 'user-2', email: 'grace@example.com' }, state: 'active' }
      }
      await refreshCloudConnection(target)
      await nextTick()
      expect(recentFiles.value).toEqual([])
    } finally {
      stop()
    }
  })

  test('tell the server the language picked while it was being checked', async () => {
    answers['/api/account/status'] = {
      status: 200,
      body: { user: { ...user, userId: 'user-changing-language' }, state: 'active' }
    }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    localeSetting.set('de')
    duringCheck = () => localeSetting.set('fr')
    expect((await refreshCloudConnection(await server())).state).toBe('signed-in')
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
    expect(locales.at(-1)).toBe('fr')
  })

  test('tell an account waiting for an administrator from one signed out', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'pending' } }
    expect((await refreshCloudConnection(await server())).state).toBe('pending')
  })

  test('tell an account with new terms to accept from one whose access was closed', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'terms' } }
    expect((await refreshCloudConnection(await server())).state).toBe('terms')
    answers['/api/account/status'] = { status: 200, body: { user, state: 'revoked' } }
    expect((await refreshCloudConnection(await server())).state).toBe('closed')
  })

  test('send the device-code token and drop it once the server stops accepting it', async () => {
    const target = await server()
    await saveCloudSessionToken(target.id, 'device-token')
    answers['/api/account/status'] = { status: 401 }
    const connection = await refreshCloudConnection(target)
    expect(authorization).toContain('Bearer device-token')
    expect(connection.state).toBe('signed-out')
    expect(await readCloudSessionToken(target.id)).toBeNull()
  })

  test('send a browser to prove its second step, and sign a desktop app in again instead', async () => {
    const target = await server()
    answers['/api/account/status'] = { status: 200, body: { user, state: 'two-step' } }
    // The browser's session proves it on the server's page.
    expect((await refreshCloudConnection(target)).state).toBe('two-step')
    // A desktop app's session from before the server asked never will; it signs in again.
    await saveCloudSessionToken(target.id, 'device-token')
    expect((await refreshCloudConnection(target)).state).toBe('expired')
    expect(await readCloudSessionToken(target.id)).toBeNull()
  })

  test('keep a token a newer sign-in stored while the server turned the old one away', async () => {
    const target = await server()
    await saveCloudSessionToken(target.id, 'device-token')
    answers['/api/account/status'] = { status: 200, body: { user, state: 'two-step' } }
    duringStatus = () => saveCloudSessionToken(target.id, 'newer-token')
    await refreshCloudConnection(target)
    expect(await readCloudSessionToken(target.id)).toBe('newer-token')
  })

  test('keep the account a newer check found over the one a late check brings back', async () => {
    const target = await server()
    const grace = { ...user, userId: 'user-2', email: 'grace@example.com' }
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [] } }
    // The first check's answer is held while a second, after Grace signed in, finishes first.
    duringStatus = async () => {
      duringStatus = undefined
      answers['/api/account/status'] = { status: 200, body: { user: grace, state: 'active' } }
      await refreshCloudConnection(target)
      answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    }
    await refreshCloudConnection(target)
    expect(cloudServers.value[0]?.account?.id).toBe('user-2')
  })

  test('call a remembered account whose session ended expired', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [] } }
    const target = await server()
    await refreshCloudConnection(target)
    answers['/api/account/status'] = { status: 401 }
    const remembered = cloudServers.value[0]
    if (!remembered) throw new Error('Expected the server to be saved')
    expect((await refreshCloudConnection(remembered)).state).toBe('expired')
    expect(cloudConnection(target.id).account?.email).toBe('ada@example.com')
  })

  test('wait for the check under way instead of starting one that throws its answer away', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    const starting = refreshCloudConnection(target)
    const waiting = checkedCloudConnection(target)
    await starting
    expect(cloudConnection(target.id).state).toBe('signed-in')
    expect((await waiting).state).toBe('signed-in')
    // One account status and one workspace list: the server was asked once.
    expect(authorization).toHaveLength(2)
  })

  test('ask a server out of reach again rather than keep its old answer', async () => {
    answers['/api/account/status'] = { status: 503, body: { error: { code: 'unavailable' } } }
    const target = await server()
    expect((await refreshCloudConnection(target)).state).toBe('unreachable')
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    expect((await recheckedCloudConnection(target)).state).toBe('signed-in')
  })

  test('take the answer of the check under way without asking twice', async () => {
    answers['/api/account/status'] = { status: 503, body: { error: { code: 'unavailable' } } }
    const target = await server()
    const starting = refreshCloudConnection(target)
    const waiting = recheckedCloudConnection(target)
    await starting
    expect((await waiting).state).toBe('unreachable')
    expect(statusRequests).toBe(1)
  })

  test('list a workspace made elsewhere in the background, keeping the last answer meanwhile', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    await refreshCloudConnection(target)

    // Nothing changed: the connection is left as it was, so nothing that shows it re-renders.
    const unchanged = cloudConnections.value
    await refreshCloudConnection(target, { background: true })
    expect(cloudConnections.value).toBe(unchanged)

    const gallery = { ...workspace, id: '2b0f9c3e-5d61-4a7e-8f20-9c1d3e4b5a60', name: 'Community' }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace, gallery] } }
    const asking = refreshCloudConnection(target, { background: true })
    // The list stays on screen while the server is asked, rather than showing a check.
    expect(cloudConnection(target.id).state).toBe('signed-in')
    await asking
    expect(cloudConnection(target.id).workspaces.map((entry) => entry.name)).toEqual([
      'Design',
      'Community'
    ])

    // A server out of reach for a moment leaves the last answer in place.
    answers['/api/account/status'] = { status: 503, body: { error: { code: 'unavailable' } } }
    expect((await refreshCloudConnection(target, { background: true })).state).toBe('signed-in')
    expect(cloudConnection(target.id).state).toBe('signed-in')
    expect(cloudConnection(target.id).workspaces).toHaveLength(2)
  })

  test('show no account as signed in once a background check met another before failing', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    await refreshCloudConnection(target)

    const other = { userId: 'user-2', email: 'grace@example.com', name: 'Grace' }
    answers['/api/account/status'] = { status: 200, body: { user: other, state: 'active' } }
    answers['/api/workspaces'] = { status: 503, body: { error: { code: 'unavailable' } } }
    await refreshCloudConnection(target, { background: true })
    expect(cloudConnection(target.id).state).not.toBe('signed-in')
    expect(cloudServers.value[0]?.account?.id).toBe('user-2')
  })

  test('answer a refresh button from a check that starts after the click', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    await refreshCloudConnection(target)

    const before = statusRequests
    const running = refreshCloudConnection(target, { background: true })
    // Made after the running check asked for the list, so only a later check can find it.
    const gallery = { ...workspace, id: '2b0f9c3e-5d61-4a7e-8f20-9c1d3e4b5a60', name: 'Community' }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace, gallery] } }
    const clicked = await refreshCloudConnection(target, { background: true, fresh: true })
    await running
    expect(statusRequests - before).toBe(2)
    expect(clicked.workspaces.map((entry) => entry.name)).toEqual(['Design', 'Community'])
  })

  test('publish a failed background check when there was no answer to keep', async () => {
    answers['/api/account/status'] = { status: 503, body: { error: { code: 'unavailable' } } }
    const target = await server()
    // No answer to keep, as after signing out drops it.
    forgetCloudConnection(target.id)
    await refreshCloudConnection(target, { background: true })
    expect(cloudConnection(target.id).state).toBe('unreachable')
  })
})
