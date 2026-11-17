import { afterEach, describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { saveDocument, THUMBNAIL_PNG } from '#cloud-tests/helpers/save'
import { cloudAdminDocumentsResponseSchema, documentDownloadSchema } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createDocumentSharingService,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import { testClient } from 'hono/testing'
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

const admin: CloudActor = {
  userId: 'alice',
  email: 'alice@example.com',
  name: 'Alice',
  deploymentRole: 'admin'
}
const member: CloudActor = { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
const idSchema = v.object({ id: v.string() })
const trusted = { Origin: config.publicURL }

const opened: { close(): Promise<void> }[] = []
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.close()
})

/**
 * Alice's server, where she is the deployment's administrator, with a Community workspace the
 * deployment names as its gallery and a private Studio. `asMember` is the same server answering
 * her as an ordinary account.
 */
async function server() {
  const runtime = await createCloudTestDatabase()
  opened.push(runtime)
  const objects = createMemoryObjectStore()
  const app = (actor: CloudActor, communityId?: string) =>
    createCloudApp({
      config: communityId ? { ...config, community: { workspaceId: communityId } } : config,
      database: runtime.database,
      auth: createBetterAuthAdapter(config, runtime.database),
      objects: objects.store,
      resolveSession: async () => actor
    })
  const owner = testClient(app(admin))
  const workspace = async (name: string) =>
    (
      await responseJSON(
        await owner.api.workspaces.$post({ json: { name } }),
        v.object({ workspace: idSchema })
      )
    ).workspace.id
  const document = async (workspaceId: string, name: string) =>
    (
      await responseJSON(
        await owner.api.workspaces[':workspaceId'].documents.$post({
          param: { workspaceId },
          json: { name }
        }),
        v.object({ document: idSchema })
      )
    ).document.id
  const save = (documentId: string, baseRevisionId: string | null, label: string) =>
    saveDocument(
      { client: owner, database: runtime.database, objects: objects.store },
      documentId,
      baseRevisionId,
      label
    )
  const community = await workspace('Community')
  const studio = await workspace('Studio')
  return {
    runtime,
    workspace: { community, studio },
    document,
    save,
    // The console's own address, which the server takes administrators' changes from.
    admin: testClient(app(admin, community), undefined, undefined, { headers: trusted }).api.admin,
    asMember: testClient(app(member, community), undefined, undefined, { headers: trusted }).api
      .admin
  }
}

describe('admin documents', () => {
  test('say who beyond its workspace can open each document, and which revision it shows', async () => {
    const { runtime, workspace, document, save, admin } = await server()
    const tour = await document(workspace.community, 'Tour')
    const tourRevision = await save(tour, null, 'tour')
    const brief = await document(workspace.studio, 'Brief')
    await document(workspace.studio, 'Draft')

    const sharing = createDocumentSharingService(runtime.database)
    await sharing.createShare('alice', brief, { permission: 'view' })
    await sharing.createShare('alice', brief, { permission: 'edit' })
    // Neither a revoked link nor an expired one still opens the document.
    const revoked = await sharing.createShare('alice', brief, { permission: 'edit' })
    await sharing.revokeShare('alice', brief, revoked.share.id)
    const expired = await sharing.createShare('alice', brief, { permission: 'edit' })
    await runtime.database
      .updateTable('documentShare')
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where('id', '=', expired.share.id)
      .execute()

    const listed = await responseJSON(
      await admin.documents.$get({ query: {} }),
      cloudAdminDocumentsResponseSchema
    )
    const byName = new Map(listed.documents.map((row) => [row.name, row]))
    expect(byName.get('Tour')).toMatchObject({
      kind: 'design',
      revisionId: tourRevision,
      exposure: { community: true, links: 0, editLinks: 0 }
    })
    expect(byName.get('Brief')?.exposure).toEqual({ community: false, links: 2, editLinks: 1 })
    // Never saved, so nothing to preview.
    expect(byName.get('Draft')).toMatchObject({
      revisionId: null,
      exposure: { community: false, links: 0, editLinks: 0 }
    })
  })

  test('serve the current revision’s thumbnail to an administrator alone', async () => {
    const { workspace, document, save, admin, asMember } = await server()
    const brief = await document(workspace.studio, 'Brief')
    const first = await save(brief, null, 'first')
    const current = await save(brief, first, 'second')
    const thumbnail = admin.documents[':documentId'].thumbnails[':revisionId']

    const shown = await thumbnail.$get({ param: { documentId: brief, revisionId: current } })
    expect(shown.status).toBe(200)
    expect(shown.headers.get('Content-Type')).toBe('image/png')
    // Asked again on each view, so the administrator checks always run; the revision is its ETag.
    expect(shown.headers.get('Cache-Control')).toBe('private, no-cache')
    expect(shown.headers.get('ETag')).toBe(`"${current}"`)
    expect([...new Uint8Array(await shown.arrayBuffer())]).toEqual([...THUMBNAIL_PNG])
    const unchanged = await thumbnail.$get(
      { param: { documentId: brief, revisionId: current } },
      { headers: { 'If-None-Match': `"${current}"` } }
    )
    expect(unchanged.status).toBe(304)

    // An older revision's address shows nothing, so a stale copy is never mistaken for it.
    expect((await thumbnail.$get({ param: { documentId: brief, revisionId: first } })).status).toBe(
      404
    )
    expect(
      (
        await asMember.documents[':documentId'].thumbnails[':revisionId'].$get({
          param: { documentId: brief, revisionId: current }
        })
      ).status
    ).toBe(403)
  })

  test('download a document as it is now, recording that an administrator did', async () => {
    const { runtime, workspace, document, save, admin, asMember } = await server()
    const brief = await document(workspace.studio, 'Brief')
    const first = await save(brief, null, 'first')
    const current = await save(brief, first, 'second')

    const downloaded = await responseJSON(
      await admin.documents[':id'].download.$post({ param: { id: brief } }),
      documentDownloadSchema
    )
    expect(downloaded.revisionId).toBe(current)
    expect(
      await runtime.database
        .selectFrom('adminAuditEvent')
        .select(['action', 'subjectType', 'subjectId', 'actorUserId'])
        .where('action', '=', 'document.downloaded')
        .execute()
    ).toEqual([
      {
        action: 'document.downloaded',
        subjectType: 'document',
        subjectId: brief,
        actorUserId: 'alice'
      }
    ])

    // Taken down, it still downloads: looking at it is what moderating it takes.
    const taken = await admin.documents[':id'].disable.$post({ param: { id: brief }, json: {} })
    expect(taken.status).toBe(200)
    const blocked = await responseJSON(
      await admin.documents[':id'].download.$post({ param: { id: brief } }),
      documentDownloadSchema
    )
    expect(blocked.revisionId).toBe(current)

    // Never saved, so there is no file; an ordinary account may not download anyone's.
    const draft = await document(workspace.studio, 'Draft')
    expect((await admin.documents[':id'].download.$post({ param: { id: draft } })).status).toBe(404)
    expect((await asMember.documents[':id'].download.$post({ param: { id: brief } })).status).toBe(
      403
    )
  })
})
