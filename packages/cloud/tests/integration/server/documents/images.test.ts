import { describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_FEATURE_KEYS,
  createBetterAuthAdapter,
  createCloudApp,
  createDefaultCloudPolicy,
  createRevisionCompactionService,
  EntitlementOpenFeatureProvider,
  parseCloudServerConfig,
  StaticEntitlementSource,
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

const alice: CloudActor = { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
const DAY_MS = 24 * 60 * 60_000
const FILE_BYTES = 128
const OCTETS = 'application/octet-stream'

/** A checksum the memory store takes as verified, one per letter. */
const checksumOf = (letter: string) => `${letter.repeat(43)}=`

type Image = { name: string; checksum: string; byteSize: number }

async function testApp() {
  const runtime = await createCloudTestDatabase()
  const objects = createMemoryObjectStore()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: objects.store,
    // Guests reach a document through its share links.
    policy: createDefaultCloudPolicy(
      new EntitlementOpenFeatureProvider(
        new StaticEntitlementSource({
          [CLOUD_FEATURE_KEYS.links]: true,
          [CLOUD_FEATURE_KEYS.guestView]: true
        })
      )
    ),
    resolveSession: async () => alice
  })
  const client = testClient(app)
  const api = contractClient(app)
  const workspace = await responseJSON(
    await client.api.workspaces.$post({ json: { name: 'Studio' } }),
    v.object({ workspace: v.object({ id: v.string() }) })
  )
  const created = await api.documents.create({
    params: { workspaceId: workspace.workspace.id },
    body: { name: 'Poster' }
  })
  const documentId = created.document.id
  let current: string | null = null
  let saves = 0

  /** Puts what an upload declared where the object store keeps it, as a client's PUT would. */
  async function store(uploadId: string) {
    const row = await runtime.database
      .selectFrom('upload')
      .select(['objectKey', 'byteSize', 'checksum'])
      .where('id', '=', uploadId)
      .executeTakeFirstOrThrow()
    objects.put(row.objectKey, {
      byteSize: Number(row.byteSize),
      checksum: row.checksum,
      checksumVerification: 'native',
      contentType: OCTETS
    })
  }

  /** Uploads the images the workspace lacks, as the editor does before a save. */
  async function uploadImages(images: Image[]) {
    const offers = await api.documents.requestImageUploads({
      params: { documentId },
      body: { images: images.map(({ checksum, byteSize }) => ({ checksum, byteSize })) }
    })
    if (offers.uploads.length === 0) return offers.uploads
    for (const offer of offers.uploads) await store(offer.uploadId)
    // Naming an upload twice lands it once.
    const commits = offers.uploads.map(({ uploadId, checksum }) => ({ uploadId, checksum }))
    await api.documents.commitImageUploads({
      params: { documentId },
      body: { uploads: [...commits, ...commits] }
    })
    return offers.uploads
  }

  /**
   * Saves the document without its images, naming them instead, and answers how the commit
   * ended.
   */
  async function save(images: Image[] = []) {
    saves++
    const checksum = checksumOf(String.fromCharCode(64 + saves))
    const upload = await api.documents.createUpload({
      params: { documentId },
      body: { baseRevisionId: current, byteSize: FILE_BYTES, checksum, contentType: OCTETS }
    })
    await store(upload.id)
    const commit = api.documents.commitUpload({
      params: { uploadId: upload.id },
      body: { checksum, images: images.map(({ name, checksum }) => ({ name, checksum })) }
    })
    const result = await outcome(commit)
    if (result === 'ok') current = (await commit).document.currentRevisionId
    return result
  }

  async function download() {
    return (await api.documents.download({ params: { documentId } })).document
  }

  async function usage() {
    return api.documents.usage({ params: { workspaceId: workspace.workspace.id } })
  }

  /** Moves saves and image requests back in time, as if they were made that long ago. */
  async function age(milliseconds: number) {
    // Stored files are as old as the saves that wrote them.
    for (const table of ['documentVersion', 'documentRevision', 'storageObject'] as const) {
      const rows = await runtime.database.selectFrom(table).select(['id', 'createdAt']).execute()
      for (const row of rows) {
        await runtime.database
          .updateTable(table)
          .set({ createdAt: new Date(row.createdAt.getTime() - milliseconds) })
          .where('id', '=', row.id)
          .execute()
      }
    }
    const images = await runtime.database
      .selectFrom('workspaceImage')
      .select(['checksum', 'touchedAt'])
      .execute()
    for (const image of images) {
      await runtime.database
        .updateTable('workspaceImage')
        .set({ touchedAt: new Date(image.touchedAt.getTime() - milliseconds) })
        .where('checksum', '=', image.checksum)
        .execute()
    }
  }

  /** Links for images the document's live room names, as its people ask for them. */
  async function links(checksums: string[], document = documentId) {
    return api.documents.imageLinks({ params: { documentId: document }, body: { checksums } })
  }

  /** Another document in the same workspace. */
  async function createDocument(name: string) {
    const created = await api.documents.create({
      params: { workspaceId: workspace.workspace.id },
      body: { name }
    })
    return created.document.id
  }

  return {
    runtime,
    objects,
    client,
    api,
    documentId,
    uploadImages,
    save,
    download,
    usage,
    age,
    links,
    createDocument
  }
}

const photo: Image = { name: '0a1b', checksum: checksumOf('P'), byteSize: 1000 }
const logo: Image = { name: '2c3d', checksum: checksumOf('L'), byteSize: 300 }

describe('Cloud document images', () => {
  test('stores each image once and gives a save its images back under their names', async () => {
    const context = await testApp()
    try {
      expect(await context.uploadImages([photo, logo])).toHaveLength(2)
      expect(await context.save([photo, logo])).toBe('ok')
      const download = await context.download()
      expect(
        download.images.map(({ name, checksum, byteSize }) => ({ name, checksum, byteSize }))
      ).toEqual([photo, logo])

      // The workspace has both, so the next save uploads neither, even under another name.
      const renamed = { ...photo, name: 'renamed' }
      expect(await context.uploadImages([renamed, logo])).toHaveLength(0)
      expect(await context.save([renamed, logo])).toBe('ok')
      expect((await context.usage()).usage).toEqual({
        bytesUsed: FILE_BYTES + photo.byteSize + logo.byteSize,
        objectCount: 3,
        documentCount: 1
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('gives back what an image request reserved when the store cannot take every upload', async () => {
    const context = await testApp()
    const createUpload = context.objects.store.createUpload.bind(context.objects.store)
    let calls = 0
    context.objects.store.createUpload = async (input) => {
      calls++
      if (calls === 2) throw new Error('object store unavailable')
      return createUpload(input)
    }
    try {
      expect(
        await outcome(
          context.api.documents.requestImageUploads({
            params: { documentId: context.documentId },
            body: {
              images: [photo, logo].map(({ checksum, byteSize }) => ({ checksum, byteSize }))
            }
          })
        )
      ).toMatchObject({ status: 500 })
      const uploads = await context.runtime.database
        .selectFrom('upload')
        .select('status')
        .where('kind', '=', 'image')
        .execute()
      expect(uploads.map((upload) => upload.status)).toEqual(['abandoned', 'abandoned'])
      const held = await context.runtime.database
        .selectFrom('uploadStorageReservation')
        .select('id')
        .where('releasedAt', 'is', null)
        .execute()
      expect(held).toHaveLength(0)

      // The retry gets both again.
      expect(await context.uploadImages([photo, logo])).toHaveLength(2)
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses a save that names an image the workspace does not hold', async () => {
    const context = await testApp()
    try {
      expect(await context.save([photo])).toMatchObject({ status: 422 })
      // Nor does committing images take a document's own upload.
      const upload = await context.api.documents.createUpload({
        params: { documentId: context.documentId },
        body: {
          baseRevisionId: null,
          byteSize: FILE_BYTES,
          checksum: checksumOf('Z'),
          contentType: OCTETS
        }
      })
      expect(
        await outcome(
          context.api.documents.commitImageUploads({
            params: { documentId: context.documentId },
            body: { uploads: [{ uploadId: upload.id, checksum: checksumOf('Z') }] }
          })
        )
      ).toMatchObject({ status: 422 })
      expect(
        await context.runtime.database.selectFrom('documentRevision').select('id').execute()
      ).toHaveLength(0)
    } finally {
      await context.runtime.close()
    }
  })

  test('a restored version keeps its images', async () => {
    const context = await testApp()
    try {
      await context.uploadImages([photo])
      await context.save([photo])
      await context.save()
      const history = await responseJSON(
        await context.client.api.documents[':documentId'].versions.$get({
          param: { documentId: context.documentId },
          query: {}
        }),
        v.object({ versions: v.array(v.object({ id: v.string(), current: v.boolean() })) })
      )
      const first = history.versions.find((version) => !version.current)
      if (!first) throw new Error('Expected the first save in the history')
      const restored = await context.client.api.documents[':documentId'].versions[
        ':versionId'
      ].restore.$post({ param: { documentId: context.documentId, versionId: first.id } })
      expect(restored.status).toBe(200)
      expect((await context.download()).images.map((image) => image.name)).toEqual([photo.name])
    } finally {
      await context.runtime.close()
    }
  })

  test('releases an image once no kept save uses it, and deletes its file', async () => {
    const context = await testApp()
    try {
      await context.save()
      await context.uploadImages([photo])
      await context.save([photo])
      await context.save()
      await context.age(2 * DAY_MS)
      const imageKey = await context.runtime.database
        .selectFrom('workspaceImage')
        .innerJoin('storageObject', 'storageObject.id', 'workspaceImage.storageObjectId')
        .select('storageObject.objectKey')
        .executeTakeFirstOrThrow()

      const result = await createRevisionCompactionService(
        context.runtime.database,
        context.objects.store
      ).compactRevisions({ batchSize: 100, graceMs: DAY_MS })
      expect(result).toMatchObject({ revisionsDeleted: 1, imagesReleased: 1, failed: 0 })
      expect(context.objects.deletedKeys).toContain(imageKey.objectKey)
      const usage = await context.runtime.database
        .selectFrom('workspaceStorageUsage')
        .select('committedBytes')
        .executeTakeFirstOrThrow()
      expect(Number(usage.committedBytes)).toBe(2 * FILE_BYTES)
    } finally {
      await context.runtime.close()
    }
  })

  test("links the images the workspace holds, for a document's people and its guests", async () => {
    const context = await testApp()
    try {
      // Uploaded for the document's live room, not saved yet; the workspace lacks the logo.
      await context.uploadImages([photo])
      expect((await context.links([photo.checksum, logo.checksum])).images).toEqual([
        expect.objectContaining({ checksum: photo.checksum, byteSize: photo.byteSize })
      ])

      // Another document's room names an image the workspace holds through the first one.
      const other = await context.createDocument('Flyer')
      expect((await context.links([photo.checksum], other)).images).toHaveLength(1)

      const created = await context.client.api.documents[':documentId'].shares.$post({
        param: { documentId: context.documentId },
        json: { permission: 'view' }
      })
      const share = await responseJSON(
        created,
        v.object({ share: v.object({ id: v.string() }), secret: v.string() })
      )
      const guest = await context.client.api.shares[':shareId'].images.$post({
        param: { shareId: share.share.id },
        json: { secret: share.secret, checksums: [photo.checksum] }
      })
      expect(guest.status).toBe(200)
      expect(await guest.json()).toMatchObject({ images: [{ checksum: photo.checksum }] })
      const wrongSecret = await context.client.api.shares[':shareId'].images.$post({
        param: { shareId: share.share.id },
        json: { secret: 'f'.repeat(48), checksums: [photo.checksum] }
      })
      expect(wrongSecret.status).toBeGreaterThanOrEqual(400)
    } finally {
      await context.runtime.close()
    }
  })
})
