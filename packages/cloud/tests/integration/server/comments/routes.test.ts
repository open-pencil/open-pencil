import { afterEach, describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { MAX_COMMENT_THREADS_PER_DOCUMENT } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createDocumentSharingService,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import { chunk } from 'es-toolkit'
import { testClient } from 'hono/testing'
import * as v from 'valibot'

const opened: { close(): Promise<void> }[] = []
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.close()
})
const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

const alice: CloudActor = { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
const pin = {
  pageId: '0:1',
  pageName: 'Page 1',
  nodeId: null,
  nodeName: null,
  offsetX: null,
  offsetY: null,
  x: 10,
  y: 20
}

async function testApp() {
  const runtime = await createCloudTestDatabase()
  opened.push(runtime)
  const announced: string[] = []
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => alice,
    onDocumentCommentsChanged: (_documentId, threadId) => announced.push(threadId)
  })
  const workspace = await responseJSON(
    await testClient(app).api.workspaces.$post({ json: { name: 'Studio' } }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const api = contractClient(app)
  const created = await api.documents.create({
    params: { workspaceId: workspace.workspace.id },
    body: { name: 'Poster' }
  })
  return { app, runtime, api, announced, documentId: created.document.id }
}

describe('comment routes', () => {
  test('start, answer, resolve, and delete a thread', async () => {
    const { api, announced, documentId } = await testApp()
    const document = { documentId }

    const { thread } = await api.comments.createThread({
      params: document,
      body: { ...pin, body: ' Hi ' }
    })
    expect(thread.comments[0]).toMatchObject({ body: 'Hi', author: { kind: 'user', id: 'alice' } })
    const params = { documentId, threadId: thread.id }

    expect(await outcome(api.comments.reply({ params, body: { body: 'Thanks' } }))).toBe('ok')
    const resolved = await api.comments.updateThread({ params, body: { resolved: true } })
    expect(resolved.thread.resolvedBy).toBe('alice')

    const listed = await api.comments.list({ params: document })
    expect(listed.access).toEqual({ canComment: true, canModerate: true, accountId: 'alice' })
    expect(listed.threads.map((listedThread) => listedThread.comments.length)).toEqual([2])

    const commentId = thread.comments[0]?.id ?? ''
    expect(await api.comments.deleteComment({ params: { ...params, commentId } })).toEqual({
      status: 204
    })
    expect(await outcome(api.comments.get({ params }))).toMatchObject({ status: 404 })
    expect(announced).toEqual([thread.id, thread.id, thread.id, thread.id])
  })

  test('turn away empty comments, unknown documents, and a document past its threads', async () => {
    const { api, runtime, documentId } = await testApp()
    const document = { documentId }
    expect(
      await outcome(api.comments.createThread({ params: document, body: { ...pin, body: '  ' } }))
    ).toMatchObject({ status: 400 })
    expect(
      await outcome(api.comments.list({ params: { documentId: crypto.randomUUID() } }))
    ).toMatchObject({ status: 404 })
    expect(
      await outcome(api.comments.list({ params: { documentId: 'not-a-uuid' } }))
    ).toMatchObject({ status: 404 })

    const full = Array.from({ length: MAX_COMMENT_THREADS_PER_DOCUMENT }, () => ({
      id: crypto.randomUUID(),
      documentId,
      ...pin,
      createdBy: 'alice'
    }))
    for (const rows of chunk(full, 500)) {
      await runtime.database.insertInto('commentThread').values(rows).execute()
    }
    expect(
      await outcome(api.comments.createThread({ params: document, body: { ...pin, body: 'More' } }))
    ).toEqual({ status: 409, code: 'comment_limit_reached' })
  })

  test('read and write through a share link', async () => {
    const { api, runtime, documentId } = await testApp()
    const link = await createDocumentSharingService(runtime.database).createShare(
      'alice',
      documentId,
      { permission: 'view' }
    )
    const shared = api.sharedComments
    const params = { shareId: link.share.id }
    const share = { secret: link.secret }

    const { thread } = await shared.createThread({ params, body: { share, ...pin, body: 'Hi' } })
    const listed = await shared.list({ params, body: { share } })
    expect(listed.threads.map((listedThread) => listedThread.id)).toEqual([thread.id])
    // A view link lets someone signed in comment, never delete others' comments.
    expect(listed.access).toEqual({ canComment: true, canModerate: false, accountId: 'alice' })

    const threadParams = { ...params, threadId: thread.id }
    const withReply = await shared.reply({ params: threadParams, body: { share, body: 'Re' } })
    expect(withReply.thread.comments.map((comment) => comment.body)).toEqual(['Hi', 'Re'])
    const resolved = await shared.updateThread({
      params: threadParams,
      body: { share, resolved: true }
    })
    expect(resolved.thread.resolvedAt).not.toBeNull()
    expect(await outcome(shared.markRead({ params: threadParams, body: { share } }))).toBe('ok')
    // The author deletes their own thread through the link.
    expect(await outcome(shared.deleteThread({ params: threadParams, body: { share } }))).toBe('ok')
    expect((await shared.list({ params, body: { share } })).threads).toEqual([])

    const wrong = { secret: 'f'.repeat(64) }
    expect(await outcome(shared.list({ params, body: { share: wrong } }))).toMatchObject({
      status: 404
    })
  })

  test('read and choose notifications, list people, and mark a thread read', async () => {
    const { app, api, documentId } = await testApp()
    expect(await api.comments.notificationSettings()).toEqual({ commentEmails: 'mentions' })
    expect(await api.comments.setNotificationSettings({ body: { commentEmails: 'all' } })).toEqual({
      commentEmails: 'all'
    })
    // A setting the contract does not name, which the typed client cannot send.
    const unknown = await app.request('/api/account/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentEmails: 'x' })
    })
    expect(unknown.status).toBe(400)

    expect(await outcome(api.comments.people({ params: { documentId } }))).toBe('ok')
    const { thread } = await api.comments.createThread({
      params: { documentId },
      body: { ...pin, body: 'Hi' }
    })
    expect(
      await outcome(api.comments.markRead({ params: { documentId, threadId: thread.id } }))
    ).toBe('ok')
  })
})
