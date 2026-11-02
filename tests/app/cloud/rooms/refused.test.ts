import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { nextTick } from 'vue'

import {
  cloudRoomsRefused,
  leaveRefusedRoom,
  rejoinRefusedRoom,
  startCloudRoom
} from '@/app/cloud/rooms/live'
import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import { refreshCloudConnection } from '@/app/cloud/sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import type { EditorStore } from '@/app/editor/session'
import { closeTab, createTab } from '@/app/tabs'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'
import { asDouble } from '#tests/helpers/doubles'
import { fetchStub } from '#tests/helpers/fetch'

/** A Cloud tab's store, recording what leaving its room did to it. */
function tab(options: { stored?: boolean } = {}) {
  const calls = { saves: 0, readOnly: [] as boolean[] }
  const store = asDouble<EditorStore>({
    state: { autosaveEnabled: false },
    getStorageBinding: () =>
      options.stored === false ? null : { providerId: 'cloud', documentId: 'document' },
    setReadOnly: (readOnly: boolean) => calls.readOnly.push(readOnly),
    saveFigFile: async () => {
      calls.saves++
    }
  })
  return { store, calls }
}

describe('a tab the relay refused', () => {
  test('shows it, and an editor saves on its own what the room no longer carries', () => {
    const { store, calls } = tab()
    leaveRefusedRoom(store, { permission: 'edit', canSave: true })
    expect(cloudRoomsRefused.value.has(store)).toBe(true)
    expect(store.state.autosaveEnabled).toBe(true)
    expect(calls.saves).toBe(1)
  })

  test('keeps a viewer read-only, and a guest without an account unsaved', () => {
    const viewer = tab()
    leaveRefusedRoom(viewer.store, { permission: 'view', canSave: false })
    expect(cloudRoomsRefused.value.has(viewer.store)).toBe(true)
    expect(viewer.calls.readOnly.at(-1)).toBe(true)
    expect(viewer.calls.saves).toBe(0)

    const guest = tab({ stored: false })
    leaveRefusedRoom(guest.store, { permission: 'edit', canSave: false })
    expect(guest.calls.saves).toBe(0)
    expect(guest.store.state.autosaveEnabled).toBe(false)
  })

  test('forgets the refusal on rejoining, and a second refusal records it once', async () => {
    const { store } = tab({ stored: false })
    leaveRefusedRoom(store, { permission: 'edit', canSave: true })
    leaveRefusedRoom(store, { permission: 'edit', canSave: true })
    expect([...cloudRoomsRefused.value].filter((refused) => refused === store)).toHaveLength(1)
    await rejoinRefusedRoom(store)
    expect(cloudRoomsRefused.value.has(store)).toBe(false)
  })
})

describe('a refused tab over time', () => {
  const ORIGIN = 'https://refused.example.com'
  const DOCUMENT = '5a0c4d2e-8f1b-4c3d-9e2a-7b6c5d4e3f21'
  let ticketRequests = 0

  beforeEach(() => {
    ticketRequests = 0
    spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async (input) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.pathname === '/.well-known/openpencil') {
          return Response.json(cloudDiscoveryFixture(ORIGIN))
        }
        if (url.pathname === '/api/account/status') {
          return Response.json({
            user: { userId: 'user-1', email: 'ben@example.com', name: 'Ben' },
            state: 'active'
          })
        }
        if (url.pathname === '/api/workspaces') return Response.json({ workspaces: [] })
        if (url.pathname === `/api/documents/${DOCUMENT}/collaboration-ticket`) {
          ticketRequests++
          // A refusal ends the start at once; a 404 would wait for the document's first upload.
          return Response.json({ error: { code: 'forbidden' } }, { status: 403 })
        }
        return Response.json({ error: { code: 'not_found' } }, { status: 404 })
      })
    )
  })

  afterEach(() => {
    for (const server of cloudServers.value) removeCloudServer(server.id)
  })

  /** A tab showing a Cloud document of a signed-in server. */
  async function cloudTab() {
    const server = await addCloudServer({ kind: 'self-hosted', url: ORIGIN })
    await refreshCloudConnection(server)
    return asDouble<EditorStore>({
      state: { autosaveEnabled: false },
      getStorageBinding: () => ({
        providerId: CLOUD_STORAGE_PROVIDER_ID,
        profileId: server.id,
        containerId: 'workspace',
        documentId: DOCUMENT
      }),
      setReadOnly: () => undefined,
      saveFigFile: async () => undefined
    })
  }

  test('does not join its room again on its own, as another tab of the server does', async () => {
    const refused = await cloudTab()
    leaveRefusedRoom(refused, { permission: 'view', canSave: false })
    await startCloudRoom(refused)
    expect(ticketRequests).toBe(0)

    const other = await cloudTab()
    await startCloudRoom(other).catch(() => undefined)
    expect(ticketRequests).toBe(1)
  })

  test('stays refused when rejoining ends without a room', async () => {
    const opened = createTab()
    leaveRefusedRoom(opened.store, { permission: 'view', canSave: false })
    // The tab has no Cloud document, so the restart finds no room to join.
    await rejoinRefusedRoom(opened.store)
    expect(cloudRoomsRefused.value.has(opened.store)).toBe(true)
    await closeTab(opened.id, 'discard')
  })

  test('forgets the refusal once its tab closes', async () => {
    const opened = createTab()
    leaveRefusedRoom(opened.store, { permission: 'view', canSave: false })
    expect(cloudRoomsRefused.value.has(opened.store)).toBe(true)
    await closeTab(opened.id, 'discard')
    await nextTick()
    expect(cloudRoomsRefused.value.has(opened.store)).toBe(false)
  })
})
