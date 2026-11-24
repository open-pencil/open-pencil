import { afterEach, describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { saveDocument, THUMBNAIL_PNG } from '#cloud-tests/helpers/save'
import { fetchCommunityExample, fetchCommunityTour } from '#cloud/client'
import {
  createBetterAuthAdapter,
  createCloudApp,
  parseCloudServerConfig,
  type CloudActor,
  type CloudServerConfig
} from '#cloud/server'
import { unzipSync } from 'fflate'
import { testClient } from 'hono/testing'

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

/** Every gallery's database, closed after its test. */
const opened: { close(): Promise<void> }[] = []
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.close()
})

/**
 * Alice's server with two workspaces: Community, which the deployment names as its gallery, and
 * Studio, which stays private. Requests to `community` come from nobody signed in.
 */
async function gallery() {
  const runtime = await createCloudTestDatabase()
  opened.push(runtime)
  const objects = createMemoryObjectStore()
  const app = (serverConfig: CloudServerConfig, signedIn: boolean) =>
    createCloudApp({
      config: serverConfig,
      database: runtime.database,
      auth: createBetterAuthAdapter(serverConfig, runtime.database),
      objects: objects.store,
      resolveSession: async () => (signedIn ? alice : null)
    })
  const ownerApp = app(config, true)
  const ownerAPI = contractClient(ownerApp)

  async function workspace(name: string) {
    const created = await ownerAPI.workspaces.create({ body: { name } })
    return created.workspace.id
  }
  async function document(workspaceId: string, name: string) {
    const created = await ownerAPI.documents.create({ params: { workspaceId }, body: { name } })
    return created.document.id
  }
  const save = (documentId: string, baseRevisionId: string | null, label: string) =>
    saveDocument(
      { api: ownerAPI, database: runtime.database, objects: objects.store },
      documentId,
      baseRevisionId,
      label
    )
  async function nameVersion(documentId: string, name: string, description = '') {
    const named = await ownerAPI.versions.save({
      params: { documentId },
      body: { name, description }
    })
    return named.version.id
  }

  const communityId = await workspace('Community')
  const studioId = await workspace('Studio')
  const community = app({ ...config, community: { workspaceId: communityId } }, false)
  return {
    runtime,
    ownerAPI,
    workspace: { community: communityId, studio: studioId },
    document,
    save,
    nameVersion,
    objects,
    visitor: testClient(community),
    visitorAPI: contractClient(community),
    /** A request to the gallery's server as a page sends it, headers and all. */
    request: (path: string, init?: RequestInit) => community.request(path, init),
    /** The gallery's server, naming `tour` as the tour editors open. */
    withTour: (tour: string) =>
      app({ ...config, community: { workspaceId: communityId, tourDocumentId: tour } }, false),
    withoutGalleryAPI: contractClient(app(config, false))
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
    await server.ownerAPI.documents.remove({ params: { documentId: trashed } })
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

    const listed = (await server.visitorAPI.community.list()).body

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
      await outcome(
        server.visitorAPI.community.document({ params: { documentId: spam }, query: {} })
      )
    ).toMatchObject({ status: 404 })
    expect(await outcome(server.withoutGalleryAPI.community.list())).toMatchObject({ status: 404 })
  })

  test('opens a document as it is now or as a named version, and nothing outside it', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Tour')
    const first = await server.save(tour, null, 'first')
    const release = await server.nameVersion(tour, '0.17.0')
    const current = await server.save(tour, first, 'second')
    const secret = await server.document(server.workspace.studio, 'Secret')
    await server.save(secret, null, 'secret')

    const latest = await server.visitorAPI.community.document({
      params: { documentId: tour },
      query: {}
    })
    expect(latest.document.revisionId).toBe(current)
    expect(latest.version).toBeNull()

    const named = await server.visitorAPI.community.document({
      params: { documentId: tour },
      query: { version: release }
    })
    expect(named.document.revisionId).toBe(first)
    expect(named.version).toMatchObject({ id: release, name: '0.17.0', description: null })

    // A checkpoint is not a published version; a private document does not exist here.
    const unnamed = await server.nameVersion(tour, 'Draft')
    await server.ownerAPI.versions.update({
      params: { documentId: tour, versionId: unnamed },
      body: { name: null }
    })
    expect(
      await outcome(
        server.visitorAPI.community.document({
          params: { documentId: tour },
          query: { version: unnamed }
        })
      )
    ).toMatchObject({ status: 404 })
    expect(
      await outcome(
        server.visitorAPI.community.document({ params: { documentId: secret }, query: {} })
      )
    ).toMatchObject({ status: 404 })
    expect(
      await outcome(
        server.visitorAPI.community.imageLinks({
          params: { documentId: secret },
          body: { checksums: [`${'A'.repeat(43)}=`] }
        })
      )
    ).toMatchObject({ status: 404 })
  })

  test('serves a gallery document’s stored parts to any page, and nothing else in storage', async () => {
    const server = await gallery()
    const tour = await server.document(server.workspace.community, 'Tour')
    const first = await server.save(tour, null, 'first')
    const release = await server.nameVersion(tour, '0.17.0')
    await server.save(tour, first, 'second')
    const secret = await server.document(server.workspace.studio, 'Secret')
    await server.save(secret, null, 'secret')
    const checksumOf = async (documentId: string) =>
      (await server.ownerAPI.documents.download({ params: { documentId } })).document.checksum
    const named = await server.visitorAPI.community.document({
      params: { documentId: tour },
      query: { version: release }
    })
    const current = await checksumOf(tour)
    const object = (documentId: string, checksum: string, version?: string) =>
      server.request(
        `/api/community/${documentId}/objects?${new URLSearchParams(version ? { checksum, version } : { checksum })}`,
        { headers: { Origin: 'http://localhost:5173' } }
      )
    const contents = async (response: Response) =>
      new TextDecoder().decode(
        unzipSync(new Uint8Array(await response.arrayBuffer()))['canvas.fig']
      )

    const now = await object(tour, current)
    expect(now.status).toBe(200)
    expect(now.headers.get('access-control-allow-origin')).toBe('*')
    // Cached only as long as the listing is, so a takedown reaches every copy within minutes.
    expect(now.headers.get('cache-control')).toBe('public, max-age=300')
    expect(now.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await contents(now)).toBe('second')
    const released = await object(tour, named.document.checksum, release)
    expect(await contents(released)).toBe('first')

    // Only the revision asked for: the release's file is not the current one's, nor the reverse.
    expect((await object(tour, named.document.checksum)).status).toBe(404)
    expect((await object(tour, current, release)).status).toBe(404)
    // Nothing outside the gallery, whatever checksum is named.
    expect((await object(secret, await checksumOf(secret))).status).toBe(404)
    expect((await object(tour, 'not-a-checksum')).status).toBe(400)
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
      const response = await server.request(path, from(docs))
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    }
    const preflight = await server.request(
      '/api/community',
      from(docs, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'GET' } })
    )
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')

    // Anything else stays with the origins the server trusts, which send their account.
    const write = await server.request(
      '/api/workspaces',
      from(docs, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } })
    )
    expect(write.headers.get('access-control-allow-origin')).toBeNull()
    const own = await server.request('/api/community', from('http://localhost:8787'))
    expect(own.headers.get('access-control-allow-origin')).toBe('http://localhost:8787')
    expect(own.headers.get('access-control-allow-credentials')).toBe('true')
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
      return server.request(`${url.pathname}${url.search}`, init)
    }
    expect(await fetchCommunityTour('http://localhost:8787', { fetch: plain })).toBeNull()
  })

  test('hands any page a gallery document by its name, as the release it asks for', async () => {
    const server = await gallery()
    const board = await server.document(server.workspace.community, 'Sprint board')
    const first = await server.save(board, null, 'first')
    await server.nameVersion(board, '0.17.0')
    await server.save(board, first, 'second')
    // Storage answers only the deployment's own pages, so nothing is read from it directly.
    let fromStorage = 0
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.host !== 'objects.example.com') {
        return server.request(`${url.pathname}${url.search}`, init)
      }
      fromStorage++
      const bytes = await server.objects.store.read(url.pathname.slice(1))
      return bytes ? new Response(Uint8Array.from(bytes)) : new Response(null, { status: 404 })
    }
    const contents = async (bytes: Uint8Array) =>
      new TextDecoder().decode(unzipSync(bytes)['canvas.fig'])

    const released = await fetchCommunityExample('http://localhost:8787', 'Sprint board', {
      version: '0.17.0',
      fetch
    })
    if (!released) throw new Error('The release of the board was not found')
    expect(released).toMatchObject({ name: 'Sprint board', version: '0.17.0' })
    expect(await contents(released.bytes)).toBe('first')
    const current = await fetchCommunityExample('http://localhost:8787', 'Sprint board', { fetch })
    if (!current) throw new Error('The board was not found')
    expect(current.version).toBeNull()
    expect(await contents(current.bytes)).toBe('second')
    expect(await fetchCommunityExample('http://localhost:8787', 'Missing', { fetch })).toBeNull()
    expect(fromStorage).toBe(0)
  })
})
