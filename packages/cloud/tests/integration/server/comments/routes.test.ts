import { afterEach, describe, expect, test } from 'bun:test'

import { contractClient } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  commentThreadResponseSchema,
  commentThreadsSchema,
  MAX_COMMENT_THREADS_PER_DOCUMENT
} from '#cloud/contract'
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
  const client = testClient(app).api
  const workspace = await responseJSON(
    await client.workspaces.$post({ json: { name: 'Studio' } }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const created = await contractClient(app).documents.create({
    params: { workspaceId: workspace.workspace.id },
    body: { name: 'Poster' }
  })
  return { app, runtime, client, announced, documentId: created.document.id }
}

describe('comment routes', () => {
  test('start, answer, resolve, and delete a thread', async () => {
    const { client, announced, documentId } = await testApp()
    const threads = client.documents[':documentId'].threads
    const document = { documentId }

    const created = await threads.$post({ param: document, json: { ...pin, body: ' Hi ' } })
    expect(created.status).toBe(201)
    const { thread } = await responseJSON(created, commentThreadResponseSchema)
    expect(thread.comments[0]).toMatchObject({ body: 'Hi', author: { kind: 'user', id: 'alice' } })
    const param = { documentId, threadId: thread.id }

    const replied = await threads[':threadId'].comments.$post({ param, json: { body: 'Thanks' } })
    expect(replied.status).toBe(201)
    const resolved = await responseJSON(
      await threads[':threadId'].$patch({ param, json: { resolved: true } }),
      commentThreadResponseSchema
    )
    expect(resolved.thread.resolvedBy).toBe('alice')

    const listed = await responseJSON(await threads.$get({ param: document }), commentThreadsSchema)
    expect(listed.access).toEqual({ canComment: true, canModerate: true, accountId: 'alice' })
    expect(listed.threads.map((listedThread) => listedThread.comments.length)).toEqual([2])

    const commentId = thread.comments[0]?.id ?? ''
    const deleted = await threads[':threadId'].comments[':commentId'].$delete({
      param: { ...param, commentId }
    })
    expect(deleted.status).toBe(204)
    expect((await threads[':threadId'].$get({ param })).status).toBe(404)
    expect(announced).toEqual([thread.id, thread.id, thread.id, thread.id])
  })

  test('turn away empty comments, unknown documents, and a document past its threads', async () => {
    const { client, runtime, documentId } = await testApp()
    const threads = client.documents[':documentId'].threads
    const document = { documentId }
    expect((await threads.$post({ param: document, json: { ...pin, body: '  ' } })).status).toBe(
      400
    )
    expect((await threads.$get({ param: { documentId: crypto.randomUUID() } })).status).toBe(404)
    expect((await threads.$get({ param: { documentId: 'not-a-uuid' } })).status).toBe(404)

    const full = Array.from({ length: MAX_COMMENT_THREADS_PER_DOCUMENT }, () => ({
      id: crypto.randomUUID(),
      documentId,
      ...pin,
      createdBy: 'alice'
    }))
    for (const rows of chunk(full, 500)) {
      await runtime.database.insertInto('commentThread').values(rows).execute()
    }
    const refused = await threads.$post({ param: document, json: { ...pin, body: 'More' } })
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: { code: 'comment_limit_reached' } })
  })

  test('read and write through a share link', async () => {
    const { client, runtime, documentId } = await testApp()
    const link = await createDocumentSharingService(runtime.database).createShare(
      'alice',
      documentId,
      { permission: 'view' }
    )
    const shares = client.shares[':shareId'].threads
    const param = { shareId: link.share.id }
    const share = { secret: link.secret }

    const created = await shares.$post({ param, json: { share, ...pin, body: 'Hi' } })
    expect(created.status).toBe(201)
    const { thread } = await responseJSON(created, commentThreadResponseSchema)
    const listed = await responseJSON(
      await shares.list.$post({ param, json: { share } }),
      commentThreadsSchema
    )
    expect(listed.threads.map((listedThread) => listedThread.id)).toEqual([thread.id])
    // A view link lets someone signed in comment, never delete others' comments.
    expect(listed.access).toEqual({ canComment: true, canModerate: false, accountId: 'alice' })

    const threadParam = { ...param, threadId: thread.id }
    const one = shares[':threadId']
    const replied = await one.comments.$post({ param: threadParam, json: { share, body: 'Re' } })
    expect(replied.status).toBe(201)
    const withReply = await responseJSON(replied, commentThreadResponseSchema)
    expect(withReply.thread.comments.map((comment) => comment.body)).toEqual(['Hi', 'Re'])
    const resolved = await one.$patch({ param: threadParam, json: { share, resolved: true } })
    expect(
      (await responseJSON(resolved, commentThreadResponseSchema)).thread.resolvedAt
    ).not.toBeNull()
    expect((await one.read.$post({ param: threadParam, json: { share } })).status).toBe(204)
    // The author deletes their own thread through the link.
    expect((await one.$delete({ param: threadParam, json: { share } })).status).toBe(204)
    const after = await shares.list.$post({ param, json: { share } })
    expect((await responseJSON(after, commentThreadsSchema)).threads).toEqual([])

    const wrong = { secret: 'f'.repeat(64) }
    expect((await shares.list.$post({ param, json: { share: wrong } })).status).toBe(404)
  })

  test('read and choose notifications, list people, and mark a thread read', async () => {
    const { app, client, documentId } = await testApp()
    const notifications = client.account.notifications
    const settings = v.object({ commentEmails: v.picklist(['all', 'mentions', 'off']) })
    expect(await responseJSON(await notifications.$get(), settings)).toEqual({
      commentEmails: 'mentions'
    })
    const chosen = await notifications.$put({ json: { commentEmails: 'all' } })
    expect(await responseJSON(chosen, settings)).toEqual({ commentEmails: 'all' })
    // A setting the contract does not name, which the typed client cannot send.
    const unknown = await app.request('/api/account/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentEmails: 'x' })
    })
    expect(unknown.status).toBe(400)

    const threads = client.documents[':documentId'].threads
    expect((await threads.people.$get({ param: { documentId } })).status).toBe(200)
    const { thread } = await responseJSON(
      await threads.$post({ param: { documentId }, json: { ...pin, body: 'Hi' } }),
      commentThreadResponseSchema
    )
    const read = await threads[':threadId'].read.$post({
      param: { documentId, threadId: thread.id }
    })
    expect(read.status).toBe(204)
  })
})
