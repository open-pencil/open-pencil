import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { saveDocument, THUMBNAIL_PNG } from '#cloud-tests/helpers/save'
import { communityDocumentsSchema, communityDownloadSchema } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  parseCloudServerConfig,
  type CloudActor,
  type CloudServerConfig
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

const alice: CloudActor = { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
const documentSchema = v.object({
  document: v.object({ id: v.string(), currentRevisionId: v.nullable(v.string()) })
})
const idSchema = v.object({ id: v.string() })

/**
 * Alice's server with two workspaces: Community, which the deployment names as its gallery, and
 * Studio, which stays private. Requests to `community` come from nobody signed in.
 */
async function gallery() {
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = (serverConfig: CloudServerConfig, signedIn: boolean) =>
    createCloudApp({
      config: serverConfig,
      database: runtime.database,
      auth: createBetterAuthAdapter(serverConfig, runtime.database),
      objects: objects.store,
      resolveSession: async () => (signedIn ? alice : null)
    })
  const owner = testClient(app(config, true))

  async function workspace(name: string) {
    const created = await responseJSON(
      await owner.api.workspaces.$post({ json: { name } }),
      v.object({ workspace: idSchema })
    )
    return created.workspace.id
  }
  async function document(workspaceId: string, name: string) {
    const created = await responseJSON(
      await owner.api.workspaces[':workspaceId'].documents.$post({
        param: { workspaceId },
        json: { name }
      }),
      documentSchema
    )
    return created.document.id
  }
  const save = (documentId: string, baseRevisionId: string | null, label: string) =>
    saveDocument(
      { client: owner, database: runtime.database, objects: objects.store },
      documentId,
      baseRevisionId,
      label
    )
  async function nameVersion(documentId: string, name: string, description = '') {
    const named = await responseJSON(
      await owner.api.documents[':documentId'].versions.$post({
        param: { documentId },
        json: { name, description }
      }),
      v.object({ version: idSchema })
    )
    return named.version.id
  }

  const communityId = await workspace('Community')
  const studioId = await workspace('Studio')
  const community = app({ ...config, community: { workspaceId: communityId } }, false)
  return {
    runtime,
    owner,
    workspace: { community: communityId, studio: studioId },
    document,
    save,
    nameVersion,
    visitor: testClient(community),
    withoutGallery: testClient(app(config, false))
  }
}

describe('community gallery', () => {
  test('lists what the community workspace holds, for someone not signed in', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Tour')
    const first = await server.save(tour, null, 'first')
    const release = await server.nameVersion(tour, '0.17.0', 'The release tour')
    const current = await server.save(tour, first, 'second')
    // Never saved, in Trash, taken down, or in another workspace: none of these is in the gallery.
    await server.document(server.workspace.community, 'Draft')
    const trashed = await server.document(server.workspace.community, 'Old')
    await server.save(trashed, null, 'old')
    await server.owner.api.documents[':documentId'].$delete({ param: { documentId: trashed } })
    const removed = await server.document(server.workspace.community, 'Removed')
    await server.save(removed, null, 'removed')
    await server.runtime.database
      .updateTable('document')
      .set({ disabledAt: new Date() })
      .where('id', '=', removed)
      .execute()
    const secret = await server.document(server.workspace.studio, 'Secret')
    await server.save(secret, null, 'secret')
    // Made by an account that is banned now: gone from the gallery while the ban lasts.
    const spam = await server.document(server.workspace.community, 'Spam')
    await server.save(spam, null, 'spam')
    const spammer = crypto.randomUUID()
    await server.runtime.database
      .insertInto('user')
      .values({ id: spammer, name: 'Spammer', email: 'spam@example.com', emailVerified: true })
      .execute()
    await server.runtime.database
      .updateTable('user')
      .set({ banned: true, banExpires: new Date(Date.now() + 60_000) })
      .where('id', '=', spammer)
      .execute()
    await server.runtime.database
      .updateTable('document')
      .set({ createdBy: spammer })
      .where('id', '=', spam)
      .execute()

    const listed = await responseJSON(
      await server.visitor.api.community.$get(),
      communityDocumentsSchema
    )

    expect(listed.documents).toEqual([
      {
        id: tour,
        name: 'Tour',
        kind: 'design',
        updatedAt: expect.any(String),
        revisionId: current,
        thumbnailPath: `/api/community/thumbnails/${tour}/${current}`,
        versions: [
          {
            id: release,
            name: '0.17.0',
            description: 'The release tour',
            createdAt: expect.any(String),
            // Saved again since it was named, so the gallery holds a newer state.
            current: false
          }
        ]
      }
    ])
    expect(
      (
        await server.visitor.api.community[':documentId'].document.$get({
          param: { documentId: spam },
          query: {}
        })
      ).status
    ).toBe(404)
    expect((await server.withoutGallery.api.community.$get()).status).toBe(404)
  })

  test('opens a document as it is now or as a named version, and nothing outside it', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Tour')
    const first = await server.save(tour, null, 'first')
    const release = await server.nameVersion(tour, '0.17.0')
    const current = await server.save(tour, first, 'second')
    const secret = await server.document(server.workspace.studio, 'Secret')
    await server.save(secret, null, 'secret')

    const latest = await responseJSON(
      await server.visitor.api.community[':documentId'].document.$get({
        param: { documentId: tour },
        query: {}
      }),
      communityDownloadSchema
    )
    expect(latest.document.revisionId).toBe(current)
    expect(latest.version).toBeNull()

    const named = await responseJSON(
      await server.visitor.api.community[':documentId'].document.$get({
        param: { documentId: tour },
        query: { version: release }
      }),
      communityDownloadSchema
    )
    expect(named.document.revisionId).toBe(first)
    expect(named.version).toMatchObject({ id: release, name: '0.17.0', description: null })

    // A checkpoint is not a published version; a private document does not exist here.
    const unnamed = await server.nameVersion(tour, 'Draft')
    await server.owner.api.documents[':documentId'].versions[':versionId'].$patch({
      param: { documentId: tour, versionId: unnamed },
      json: { name: null }
    })
    expect(
      (
        await server.visitor.api.community[':documentId'].document.$get({
          param: { documentId: tour },
          query: { version: unnamed }
        })
      ).status
    ).toBe(404)
    expect(
      (
        await server.visitor.api.community[':documentId'].document.$get({
          param: { documentId: secret },
          query: {}
        })
      ).status
    ).toBe(404)
    expect(
      (
        await server.visitor.api.community[':documentId'].images.$post({
          param: { documentId: secret },
          json: { checksums: [`${'A'.repeat(43)}=`] }
        })
      ).status
    ).toBe(404)
  })

  test('serves the thumbnail the current revision carries, to be cached for good', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Tour')
    const first = await server.save(tour, null, 'first')
    const current = await server.save(tour, first, 'second')

    const thumbnail = await server.visitor.api.community.thumbnails[':documentId'][
      ':revisionId'
    ].$get({ param: { documentId: tour, revisionId: current } })
    expect(thumbnail.status).toBe(200)
    expect(thumbnail.headers.get('content-type')).toBe('image/png')
    // Cached no longer than the listing, so a takedown reaches every copy within minutes.
    expect(thumbnail.headers.get('cache-control')).toBe('public, max-age=300')
    expect([...new Uint8Array(await thumbnail.arrayBuffer())]).toEqual([...THUMBNAIL_PNG])

    // An address for a revision that is no longer current shows nothing rather than old work.
    expect(
      (
        await server.visitor.api.community.thumbnails[':documentId'][':revisionId'].$get({
          param: { documentId: tour, revisionId: first }
        })
      ).status
    ).toBe(404)
  })
})
