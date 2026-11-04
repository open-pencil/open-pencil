import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { createConversationStore, createTraceStore } from '@/app/ai/chat/history/idb'
import type { Conversation } from '@/app/ai/chat/history/types'
import type { RunTrace } from '@/app/ai/chat/trace/types'

function conversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    documentName: 'Dashboard',
    title: 'Create a dashboard',
    titleSource: 'fallback',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    profileId: null,
    backend: 'direct',
    interrupted: false,
    messages: [
      {
        message: { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Model context' }] },
        displayText: 'Create a dashboard',
        attachments: [
          {
            id: 'image',
            messageId: 'user',
            kind: 'image',
            name: 'reference.png',
            mediaType: 'image/png',
            originalSize: { x: 1, y: 1 },
            preview: new Blob(['image'], { type: 'image/png' })
          }
        ]
      }
    ]
  }
}

describe('conversation IndexedDB storage', () => {
  test('restores messages, presentation, blobs and selected conversation through a new store', async () => {
    const first = createConversationStore()
    const row = conversation()
    await first.write(row)
    await first.select(row.documentId, row.id)
    const reopened = createConversationStore()
    const restored = await reopened.read(row.id)
    expect(restored?.messages[0].message).toEqual(row.messages[0].message)
    expect(restored?.messages[0].displayText).toBe('Create a dashboard')
    expect(await restored?.messages[0].attachments[0].preview.text()).toBe('image')
    expect(await reopened.getSelected(row.documentId)).toBe(row.id)
    expect((await reopened.list(row.documentId)).map((meta) => meta.id)).toEqual([row.id])
  })

  test('manual rename survives a delayed fallback snapshot', async () => {
    const store = createConversationStore()
    const row = conversation()
    await store.write(row)
    await store.rename(row.id, '  My dashboard  ')
    await store.write(row)
    expect((await store.read(row.id))?.title).toBe('My dashboard')
    expect((await store.read(row.id))?.titleSource).toBe('manual')
  })

  test('selection cannot bind a conversation to the wrong document', async () => {
    const store = createConversationStore()
    const row = conversation()
    await store.write(row)
    expect(store.select('another-document', row.id)).rejects.toThrow('different document')
    expect(await store.getSelected('another-document')).toBeNull()
  })

  test('saving an untitled document moves all chats and its selection atomically', async () => {
    const store = createConversationStore()
    const row = conversation()
    const second = { ...conversation(), documentId: row.documentId }
    await store.write(row)
    await store.write(second)
    await store.select(row.documentId, second.id)
    const target = `file:${crypto.randomUUID()}`
    await store.reassignDocument(row.documentId, target, 'Saved document')
    expect(await store.list(row.documentId)).toEqual([])
    expect((await store.list(target)).map((meta) => meta.documentName)).toEqual([
      'Saved document',
      'Saved document'
    ])
    await store.write(row)
    expect((await store.read(row.id))?.documentId).toBe(target)
    expect(await store.getSelected(target)).toBe(second.id)
    expect(await store.getSelected(row.documentId)).toBeNull()
  })

  test('a stale writer cannot resurrect a deleted conversation', async () => {
    const store = createConversationStore()
    const staleWriter = createConversationStore()
    const row = conversation()
    await store.write(row)
    await store.remove(row.id)
    await expect(staleWriter.write(row)).rejects.toThrow('deleted')
    expect(await store.read(row.id)).toBeNull()
  })

  test('an older manual title cannot overwrite a newer rename', async () => {
    const store = createConversationStore()
    const row = { ...conversation(), title: 'Old title', titleSource: 'manual' as const }
    await store.write(row)
    await store.rename(row.id, 'New title')
    await store.write(row)
    expect((await store.read(row.id))?.title).toBe('New title')
  })

  test('deletion removes content and active selection without affecting other chats', async () => {
    const store = createConversationStore()
    const row = conversation()
    const other = { ...conversation(), documentId: row.documentId }
    await store.write(row)
    await store.write(other)
    await store.select(row.documentId, row.id)
    await store.remove(row.id)
    expect(await store.read(row.id)).toBeNull()
    expect(await store.getSelected(row.documentId)).toBeNull()
    expect((await store.list(row.documentId)).map((meta) => meta.id)).toEqual([other.id])
  })

  test('keeps a conversation’s runs until the conversation is deleted, and not after', async () => {
    const store = createConversationStore()
    const traces = createTraceStore()
    const saved = conversation()
    await store.write(saved)
    const run = (runId: string, startedAt: string): RunTrace => ({
      conversationId: saved.id,
      runId,
      startedAt,
      model: { provider: 'openai', id: 'test' },
      settings: { maxOutputTokens: 100, maxSteps: 5, thinking: 'default', cache: false },
      instructions: 'sha256:instructions',
      input: { through: 'user', messages: 1 },
      steps: [],
      outcome: 'completed'
    })
    await traces.putRun(run('second', '2026-01-01T00:02:00.000Z'))
    await traces.putRun(run('first', '2026-01-01T00:01:00.000Z'))
    await traces.putAsset('sha256:instructions', { kind: 'instructions', text: 'Design well.' })

    expect((await traces.listRuns(saved.id)).map((entry) => entry.runId)).toEqual([
      'first',
      'second'
    ])
    expect(await traces.getAsset('sha256:instructions')).toEqual({
      kind: 'instructions',
      text: 'Design well.'
    })

    await store.remove(saved.id)
    expect(await traces.listRuns(saved.id)).toEqual([])
    // A run still streaming when its conversation was deleted does not bring it back.
    await traces.putRun(run('late', '2026-01-01T00:03:00.000Z'))
    expect(await traces.listRuns(saved.id)).toEqual([])
  })
})
