import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { fetchCommunityTour } from '#cloud/client'
import { communityDocumentsSchema, communityDownloadSchema } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  parseCloudServerConfig,
  type CloudActor,
  type CloudServerConfig
} from '#cloud/server'
import { unzipSync, zipSync } from 'fflate'
import { fromUint8Array, toUint8Array } from 'js-base64'
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
/** A 2×2 PNG, the smallest thumbnail the reader takes for one. */
const PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGP4z8DwH4QZYAwAR8oH+WdZbrcAAAAASUVORK5CYII='
)
const documentSchema = v.object({
  document: v.object({ id: v.string(), currentRevisionId: v.nullable(v.string()) })
})
const idSchema = v.object({ id: v.string() })

async function sha256(bytes: Uint8Array): Promise<string> {
  return fromUint8Array(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))
  )
}

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
  const owner = app(config, true)
  const request = (path: string, init: { method?: string; json?: unknown } = {}) =>
    owner.request(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init.json === undefined ? undefined : JSON.stringify(init.json)
    })

  async function workspace(name: string) {
    const created = await responseJSON(
      await request('/workspaces', { method: 'POST', json: { name } }),
      v.object({ workspace: idSchema })
    )
    return created.workspace.id
  }
  async function document(workspaceId: string, name: string) {
    const created = await responseJSON(
      await request(`/workspaces/${workspaceId}/documents`, { method: 'POST', json: { name } }),
      documentSchema
    )
    return created.document.id
  }
  /** Saves the document the way the editor does, as a file that carries a thumbnail. */
  async function save(documentId: string, baseRevisionId: string | null, label: string) {
    const bytes = zipSync({ 'canvas.fig': new TextEncoder().encode(label), 'thumbnail.png': PNG })
    const checksum = await sha256(bytes)
    const upload = await responseJSON(
      await request(`/documents/${documentId}/uploads`, {
        method: 'POST',
        json: {
          baseRevisionId,
          byteSize: bytes.byteLength,
          checksum,
          contentType: 'application/octet-stream'
        }
      }),
      idSchema
    )
    const row = await runtime.database
      .selectFrom('upload')
      .select('objectKey')
      .where('id', '=', upload.id)
      .executeTakeFirstOrThrow()
    await objects.store.write({
      key: row.objectKey,
      bytes,
      checksum,
      contentType: 'application/octet-stream'
    })
    const committed = await responseJSON(
      await request(`/uploads/${upload.id}/commit`, { method: 'POST', json: { checksum } }),
      documentSchema
    )
    const revision = committed.document.currentRevisionId
    if (!revision) throw new Error('The save left no revision')
    return revision
  }
  async function nameVersion(documentId: string, name: string, description = '') {
    const named = await responseJSON(
      await request(`/documents/${documentId}/versions`, {
        method: 'POST',
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
    request,
    workspace: { community: communityId, studio: studioId },
    document,
    save,
    nameVersion,
    objects,
    visitor: (path: string, init?: RequestInit) => community.request(path, init),
    /** The gallery's server, naming `tour` as the tour editors open. */
    withTour: (tour: string) =>
      app({ ...config, community: { workspaceId: communityId, tourDocumentId: tour } }, false),
    withoutGallery: (path: string) => app(config, false).request(path)
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
    await server.request(`/documents/${trashed}`, { method: 'DELETE' })
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
      await server.visitor('/api/community'),
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
            createdAt: expect.any(String)
          }
        ]
      }
    ])
    expect((await server.visitor(`/api/community/${spam}/document`)).status).toBe(404)
    expect((await server.withoutGallery('/api/community')).status).toBe(404)
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
      await server.visitor(`/api/community/${tour}/document`),
      communityDownloadSchema
    )
    expect(latest.document.revisionId).toBe(current)
    expect(latest.version).toBeNull()

    const named = await responseJSON(
      await server.visitor(`/api/community/${tour}/document?version=${release}`),
      communityDownloadSchema
    )
    expect(named.document.revisionId).toBe(first)
    expect(named.version).toMatchObject({ id: release, name: '0.17.0', description: null })

    // A checkpoint is not a published version; a private document does not exist here.
    const unnamed = await server.nameVersion(tour, 'Draft')
    await server.request(`/documents/${tour}/versions/${unnamed}`, {
      method: 'PATCH',
      json: { name: null }
    })
    expect(
      (await server.visitor(`/api/community/${tour}/document?version=${unnamed}`)).status
    ).toBe(404)
    expect((await server.visitor(`/api/community/${secret}/document`)).status).toBe(404)
    expect(
      (
        await server.visitor(`/api/community/${secret}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checksums: [`${'A'.repeat(43)}=`] })
        })
      ).status
    ).toBe(404)
  })

  test('lets any page read the gallery and the discovery, without an account', async () => {
    const server = await gallery()
    const from = (origin: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      headers.set('Origin', origin)
      return { ...init, headers }
    }
    const docs = 'https://docs.example.com'

    for (const path of ['/api/community', '/.well-known/openpencil']) {
      const response = await server.visitor(path, from(docs))
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    }
    const preflight = await server.visitor(
      '/api/community',
      from(docs, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'GET' } })
    )
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')

    // Anything else stays with the origins the server trusts, which send their account.
    const write = await server.visitor(
      '/api/workspaces',
      from(docs, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } })
    )
    expect(write.headers.get('access-control-allow-origin')).toBeNull()
    const own = await server.visitor('/api/community', from('http://localhost:8787'))
    expect(own.headers.get('access-control-allow-origin')).toBe('http://localhost:8787')
    expect(own.headers.get('access-control-allow-credentials')).toBe('true')
  })

  test('serves the thumbnail the current revision carries, to be cached for good', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Tour')
    const first = await server.save(tour, null, 'first')
    const current = await server.save(tour, first, 'second')

    const thumbnail = await server.visitor(`/api/community/thumbnails/${tour}/${current}`)
    expect(thumbnail.status).toBe(200)
    expect(thumbnail.headers.get('content-type')).toBe('image/png')
    // Cached no longer than the listing, so a takedown reaches every copy within minutes.
    expect(thumbnail.headers.get('cache-control')).toBe('public, max-age=300')
    expect([...new Uint8Array(await thumbnail.arrayBuffer())]).toEqual([...PNG])

    // An address for a revision that is no longer current shows nothing rather than old work.
    expect((await server.visitor(`/api/community/thumbnails/${tour}/${first}`)).status).toBe(404)
  })

  test('hands any page the tour as the release it asks for, else as it is now', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Welcome tour')
    const first = await server.save(tour, null, 'first')
    await server.nameVersion(tour, '0.17.0')
    await server.save(tour, first, 'second')
    const tourServer = server.withTour(tour)
    const credentials: (RequestCredentials | undefined)[] = []
    // The server answers its own addresses, and the object store its download links.
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      credentials.push(init?.credentials)
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.host !== 'objects.example.com') {
        return tourServer.request(`${url.pathname}${url.search}`, init)
      }
      const bytes = await server.objects.store.read(url.pathname.slice(1))
      return bytes ? new Response(Uint8Array.from(bytes)) : new Response(null, { status: 404 })
    }
    const contents = async (bytes: Uint8Array) =>
      new TextDecoder().decode(unzipSync(bytes)['canvas.fig'])

    const released = await fetchCommunityTour('http://localhost:8787', { version: '0.17.0', fetch })
    if (!released) throw new Error('The release of the tour was not found')
    expect(released.version).toBe('0.17.0')
    expect(await contents(released.bytes)).toBe('first')
    const current = await fetchCommunityTour('http://localhost:8787', { version: '9.9.9', fetch })
    if (!current) throw new Error('The tour was not found')
    expect(current.version).toBeNull()
    expect(await contents(current.bytes)).toBe('second')
    // No request carries an account, so it works from any page.
    expect(credentials.every((value) => value === 'omit')).toBe(true)

    // A server naming no tour has none to give.
    const plain = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      return server.visitor(`${url.pathname}${url.search}`, init)
    }
    expect(await fetchCommunityTour('http://localhost:8787', { fetch: plain })).toBeNull()
  })
})
