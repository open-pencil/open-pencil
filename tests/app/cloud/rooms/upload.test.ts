import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { CloudAPIError } from '@open-pencil/cloud/client'

import { onceOnServer, shareRoomUploads, uploadStoredDocument } from '@/app/cloud/rooms/upload'
import type { CollabAction, CollabActionReceiver } from '@/app/collab/transport/types'
import type { EditorStore } from '@/app/editor/session'
import { createMemoryLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import { createMemoryOutbox, resetOutboxForTests } from '@/app/storage/sync'
import { emitStorageWorkspaceEvent } from '@/app/storage/workspace/events'

import { asDouble } from '#tests/helpers/doubles'

/**
 * A room of tabs whose channel delivers to everyone else, or to one tab when named; `overheard`
 * delivers everything to everyone, as if a peer could read what was meant for another.
 */
function room({ overheard = false } = {}) {
  const receivers = new Map<string, CollabActionReceiver>()
  const tab = (peerId: string): CollabAction => [
    (data, target) => {
      for (const [other, receive] of receivers) {
        if (other !== peerId && (overheard || !target || target === other)) receive(data, peerId)
      }
    },
    (handler) => {
      receivers.set(peerId, handler)
    }
  ]
  return { tab }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const questionSchema = v.pipe(v.string(), v.parseJson(), v.object({ id: v.string() }))

describe('room uploads', () => {
  test('the saver uploads itself; anyone else hears back from the saver', async () => {
    const { tab } = room()
    const calls: string[] = []
    const saver = shareRoomUploads(tab('saver'), {
      saving: () => true,
      saverPeer: () => null,
      upload: async () => {
        calls.push('saver')
        return true
      }
    })
    const other = shareRoomUploads(tab('other'), {
      saving: () => false,
      saverPeer: () => 'saver',
      upload: async () => {
        calls.push('other')
        return true
      }
    })
    expect(await saver.upload()).toBe(true)
    expect(await other.upload()).toBe(true)
    expect(calls).toEqual(['saver', 'saver'])
  })

  test('only the saver’s answer counts', async () => {
    const { tab } = room({ overheard: true })
    let finish: (uploaded: boolean) => void = () => undefined
    shareRoomUploads(tab('saver'), {
      saving: () => true,
      saverPeer: () => null,
      upload: () =>
        new Promise((resolve) => {
          finish = resolve
        })
    })
    // Another editor overhears the question and answers it at once.
    const [forge, listen] = tab('forger')
    listen((data, peerId) => {
      const question = v.safeParse(questionSchema, decoder.decode(data))
      if (!question.success) return
      const reply = { type: 'reply', id: question.output.id, uploaded: true }
      forge(encoder.encode(JSON.stringify(reply)), peerId)
    })
    const asking = shareRoomUploads(tab('other'), {
      saving: () => false,
      saverPeer: () => 'saver',
      upload: async () => true
    })
    let settled = false
    const answer = asking.upload().finally(() => {
      settled = true
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(settled).toBe(false)
    finish(false)
    expect(await answer).toBe(false)
  })

  test('a tab that no longer saves answers at once rather than leave the question waiting', async () => {
    const { tab } = room()
    shareRoomUploads(tab('saver'), {
      saving: () => false,
      saverPeer: () => null,
      upload: async () => true
    })
    const asking = shareRoomUploads(tab('other'), {
      saving: () => false,
      saverPeer: () => 'saver',
      upload: async () => true,
      timeoutMs: 60_000
    })
    expect(await asking.upload()).toBe(false)
  })

  test('a failed upload, or no saver to ask, says the document is not there', async () => {
    const failing = room()
    shareRoomUploads(failing.tab('saver'), {
      saving: () => true,
      saverPeer: () => null,
      upload: () => Promise.reject(new Error('Offline'))
    })
    const asking = shareRoomUploads(failing.tab('other'), {
      saving: () => false,
      saverPeer: () => 'saver',
      upload: async () => true
    })
    expect(await asking.upload()).toBe(false)

    const empty = room()
    const alone = shareRoomUploads(empty.tab('other'), {
      saving: () => false,
      saverPeer: () => null,
      upload: async () => true
    })
    expect(await alone.upload()).toBe(false)

    const silent = shareRoomUploads(empty.tab('waiting'), {
      saving: () => false,
      saverPeer: () => 'gone',
      upload: async () => true,
      timeoutMs: 10
    })
    expect(await silent.upload()).toBe(false)
  })

  test('leaving the room ends what this tab was waiting for', async () => {
    const { tab } = room()
    const uploads = shareRoomUploads(tab('other'), {
      saving: () => false,
      saverPeer: () => 'saver',
      upload: async () => true
    })
    const waiting = uploads.upload()
    uploads.stop()
    expect(await waiting).toBe(false)
  })
})

describe('uploading the document a tab shows', () => {
  let local: LocalCanvasStore

  beforeEach(async () => {
    local = createMemoryLocalCanvasStore()
    resetLocalCanvasStoreForTests(local)
    resetOutboxForTests(createMemoryOutbox())
    await local.writeCanvas({
      id: 'doc',
      providerId: 'cloud',
      name: 'Poster',
      figBytes: new Uint8Array([1]),
      syncStatus: 'pending'
    })
  })

  afterEach(() => {
    resetLocalCanvasStoreForTests()
    resetOutboxForTests()
  })

  test('waits for a save still on its way, though nothing is left unsaved', async () => {
    const store = asDouble<EditorStore>({
      getStorageBinding: () => ({ documentId: 'doc' }),
      hasUnsavedChanges: () => false
    })
    let settled = false
    const uploading = uploadStoredDocument(store).finally(() => {
      settled = true
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(settled).toBe(false)
    await local.updateMeta('doc', { syncStatus: 'synced' })
    emitStorageWorkspaceEvent({ providerId: 'cloud', documentId: 'doc', kind: 'changed' })
    expect(await uploading).toBe(true)
  })

  test('a new document’s server is asked again once its first upload lands', async () => {
    const answers = [new CloudAPIError('Not found', 404)]
    let calls = 0
    const request = async () => {
      calls++
      const answer = answers.shift()
      if (answer) throw answer
      return 'ticket'
    }
    let settled = false
    const asking = onceOnServer('doc', request).finally(() => {
      settled = true
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(settled).toBe(false)
    await local.updateMeta('doc', { syncStatus: 'synced' })
    emitStorageWorkspaceEvent({ providerId: 'cloud', documentId: 'doc', kind: 'changed' })
    expect(await asking).toBe('ticket')
    expect(calls).toBe(2)
  })

  test('a document its server still does not know after uploading, or another error, fails', async () => {
    await local.updateMeta('doc', { syncStatus: 'synced' })
    let calls = 0
    const refuse = (status: number) => async () => {
      calls++
      throw new CloudAPIError('Refused', status)
    }
    await expect(onceOnServer('doc', refuse(404))).rejects.toThrow('Refused')
    expect(calls).toBe(2)
    calls = 0
    await expect(onceOnServer('doc', refuse(500))).rejects.toThrow('Refused')
    expect(calls).toBe(1)
  })

  test('a tab that stops waiting for its document’s upload asks no more', async () => {
    let calls = 0
    const closed = new AbortController()
    const asking = onceOnServer(
      'doc',
      async () => {
        calls++
        throw new CloudAPIError('Not found', 404)
      },
      closed.signal
    )
    // The server has answered and the tab is waiting for the upload, which is still on its way.
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(calls).toBe(1)
    closed.abort()
    await expect(asking).rejects.toThrow('Not found')
    expect(calls).toBe(1)
  })
})
