import { describe, expect, test } from 'bun:test'

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
import * as v from 'valibot'

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
  const announced: string[] = []
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => alice,
    onDocumentCommentsChanged: (_documentId, threadId) => announced.push(threadId)
  })
  const request = (path: string, init: { method?: string; json?: unknown } = {}) =>
    app.request(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init.json === undefined ? undefined : JSON.stringify(init.json)
    })
  const workspace = await responseJSON(
    await request('/workspaces', { method: 'POST', json: { name: 'Studio' } }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const created = await responseJSON(
    await request(`/workspaces/${workspace.workspace.id}/documents`, {
      method: 'POST',
      json: { name: 'Poster' }
    }),
    v.object({ document: v.object({ id: v.string() }) })
  )
  return { runtime, request, announced, documentId: created.document.id }
}

describe('comment routes', () => {
  test('start, answer, resolve, and delete a thread', async () => {
    const { request, announced, documentId } = await testApp()
    const threads = `/documents/${documentId}/threads`

    const created = await request(threads, { method: 'POST', json: { ...pin, body: ' Hi ' } })
    expect(created.status).toBe(201)
    const { thread } = await responseJSON(created, commentThreadResponseSchema)
    expect(thread.comments[0]).toMatchObject({ body: 'Hi', author: { kind: 'user', id: 'alice' } })

    const replied = await request(`${threads}/${thread.id}/comments`, {
      method: 'POST',
      json: { body: 'Thanks' }
    })
    expect(replied.status).toBe(201)
    const resolved = await responseJSON(
      await request(`${threads}/${thread.id}`, { method: 'PATCH', json: { resolved: true } }),
      commentThreadResponseSchema
    )
    expect(resolved.thread.resolvedBy).toBe('alice')

    const listed = await responseJSON(await request(threads), commentThreadsSchema)
    expect(listed.access).toEqual({ canComment: true, canModerate: true })
    expect(listed.threads.map((listedThread) => listedThread.comments.length)).toEqual([2])

    const first = thread.comments[0]?.id ?? ''
    const deleted = await request(`${threads}/${thread.id}/comments/${first}`, { method: 'DELETE' })
    expect(deleted.status).toBe(204)
    expect((await request(`${threads}/${thread.id}`)).status).toBe(404)
    expect(announced).toEqual([thread.id, thread.id, thread.id, thread.id])
  })

  test('turn away empty comments, unknown documents, and a document past its threads', async () => {
    const { request, runtime, documentId } = await testApp()
    const threads = `/documents/${documentId}/threads`
    expect((await request(threads, { method: 'POST', json: { ...pin, body: '  ' } })).status).toBe(
      400
    )
    expect((await request(`/documents/${crypto.randomUUID()}/threads`)).status).toBe(404)
    expect((await request('/documents/not-a-uuid/threads')).status).toBe(404)

    const full = Array.from({ length: MAX_COMMENT_THREADS_PER_DOCUMENT }, () => ({
      id: crypto.randomUUID(),
      documentId,
      ...pin,
      createdBy: 'alice'
    }))
    for (const rows of chunk(full, 500)) {
      await runtime.database.insertInto('commentThread').values(rows).execute()
    }
    const refused = await request(threads, { method: 'POST', json: { ...pin, body: 'More' } })
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: { code: 'comment_limit_reached' } })
  })

  test('read and write through a share link', async () => {
    const { request, runtime, documentId } = await testApp()
    const link = await createDocumentSharingService(runtime.database).createShare(
      'alice',
      documentId,
      { permission: 'view' }
    )
    const shares = `/shares/${link.share.id}/threads`
    const share = { secret: link.secret }

    const created = await request(shares, { method: 'POST', json: { share, ...pin, body: 'Hi' } })
    expect(created.status).toBe(201)
    const { thread } = await responseJSON(created, commentThreadResponseSchema)
    const listed = await responseJSON(
      await request(`${shares}/list`, { method: 'POST', json: { share } }),
      commentThreadsSchema
    )
    expect(listed.threads.map((listedThread) => listedThread.id)).toEqual([thread.id])
    // A view link lets someone signed in comment, never delete others' comments.
    expect(listed.access).toEqual({ canComment: true, canModerate: false })

    const wrong = { secret: 'f'.repeat(64) }
    expect(
      (await request(`${shares}/list`, { method: 'POST', json: { share: wrong } })).status
    ).toBe(404)
  })
})
