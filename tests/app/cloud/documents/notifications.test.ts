import { afterEach, beforeEach, describe, expect, mock, spyOn, test, type Mock } from 'bun:test'

import { nextTick } from 'vue'

import { asDouble } from '@open-pencil/test-support/doubles'

import { conflictChoiceRequested } from '@/app/cloud/documents/conflict'
import { watchCloudDocumentNotices } from '@/app/cloud/documents/notifications'
import { cloudRoomPermissions, cloudRoomsAtStorageLimit } from '@/app/cloud/rooms/live'
import { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import * as notifications from '@/app/shell/notifications'
import * as localStore from '@/app/storage/local-store'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'
import { closeTab, createTab } from '@/app/tabs'

const DOCUMENT = '6f1d2c3b-4a5e-4f60-8b71-92a3b4c5d6e7'
const LOCATION = { providerId: CLOUD_STORAGE_PROVIDER_ID, profileId: 'server', containerId: 'w' }

let notify: Mock<typeof notifications.notify>
let status: LocalCanvasMeta['syncStatus'] = 'pending'
let stop: () => void = () => undefined
let openedIds: string[] = []

function openCloudTab() {
  const tab = createTab()
  const binding = spyOn(tab.store, 'getStorageBinding').mockReturnValue(
    asDouble<StorageDocumentBinding>({ ...LOCATION, documentId: DOCUMENT })
  )
  openedIds.push(tab.id)
  return { ...tab, binding }
}

/** The sync engine records the document's status and says it changed, as after an upload. */
async function syncs(next: LocalCanvasMeta['syncStatus']) {
  status = next
  emitStorageWorkspaceEvent({ ...LOCATION, documentId: DOCUMENT, kind: 'changed' })
  await Bun.sleep(0)
}

const shown = () => notify.mock.calls.map(([notice]) => [notice.event, notice.tabId])

beforeEach(() => {
  status = 'pending'
  notify = spyOn(notifications, 'notify').mockImplementation(() => undefined)
  spyOn(localStore, 'getLocalCanvasStore').mockReturnValue(
    asDouble<ReturnType<typeof localStore.getLocalCanvasStore>>({
      getMeta: async () => asDouble<LocalCanvasMeta>({ syncStatus: status })
    })
  )
  stop = watchCloudDocumentNotices()
})

afterEach(async () => {
  stop()
  mock.restore()
  cloudRoomPermissions.value = new Map()
  cloudRoomsAtStorageLimit.value = new Set()
  for (const id of openedIds) await closeTab(id, 'discard')
  openedIds = []
  conflictChoiceRequested.value = null
})

describe('Cloud document notifications', () => {
  test('tell once about a conflict in an open tab, and again after it was resolved', async () => {
    const { id } = openCloudTab()
    await syncs('conflict')
    await syncs('conflict')
    expect(shown()).toEqual([['cloudConflict', id]])

    await syncs('synced')
    await syncs('conflict')
    expect(shown()).toHaveLength(2)
  })

  test('open the version choice on a click, unless the tab moved to a copy meanwhile', async () => {
    const { binding } = openCloudTab()
    await syncs('conflict')
    const open = () => notify.mock.calls.at(-1)?.[0].open?.()
    open()
    expect(conflictChoiceRequested.value).not.toBeNull()

    conflictChoiceRequested.value = null
    // Keeping both versions moves the tab to the copy.
    binding.mockReturnValue(
      asDouble<StorageDocumentBinding>({ ...LOCATION, documentId: crypto.randomUUID() })
    )
    open()
    expect(conflictChoiceRequested.value).toBeNull()
  })

  test('tell the tab outside a room when another tab of the document is in one', async () => {
    const live = openCloudTab()
    const waiting = openCloudTab()
    cloudRoomPermissions.value = new Map([[live.store, 'edit']])
    await nextTick()
    await syncs('conflict')
    expect(shown()).toEqual([['cloudConflict', waiting.id]])
  })

  test('leave out a conflict the room settles, and one of a document no tab shows', async () => {
    await syncs('conflict')
    const { store } = openCloudTab()
    cloudRoomPermissions.value = new Map([[store, 'edit']])
    await nextTick()
    await syncs('synced')
    await syncs('conflict')
    expect(shown()).toEqual([])
  })

  test('tell when an editing tab becomes view only at the storage limit, not one opened so', async () => {
    const { id, store } = openCloudTab()
    cloudRoomPermissions.value = new Map([[store, 'view']])
    cloudRoomsAtStorageLimit.value = new Set([store])
    await nextTick()
    expect(shown()).toEqual([])

    // Its owner frees space, the tab edits, and then their storage fills again.
    cloudRoomsAtStorageLimit.value = new Set()
    cloudRoomPermissions.value = new Map([[store, 'edit']])
    await nextTick()
    // The room is joined again with its new access: the tab leaves it, then views.
    cloudRoomPermissions.value = new Map()
    await nextTick()
    cloudRoomPermissions.value = new Map([[store, 'view']])
    cloudRoomsAtStorageLimit.value = new Set([store])
    await nextTick()
    expect(shown()).toEqual([['cloudStorageFull', id]])
  })
})
