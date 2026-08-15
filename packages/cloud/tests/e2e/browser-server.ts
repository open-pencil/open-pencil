import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createNodeCloudDatabase, createS3ObjectStore } from '@open-pencil/cloud/runtime/node'
import {
  createCloudApp,
  createCloudAuth,
  migrateCloudDatabase,
  parseCloudServerConfig
} from '@open-pencil/cloud/server'

import { cloudE2EActors, createCloudE2ESessionResolver } from './session'

const port = Number(process.env.OPENPENCIL_CLOUD_E2E_PORT ?? 8787)
const appOrigin = process.env.OPENPENCIL_APP_ORIGIN ?? 'http://localhost:1420'
const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: `http://localhost:${port}`,
  trustedOrigins: [appOrigin],
  databaseURL:
    process.env.DATABASE_URL ??
    'postgresql://openpencil:openpencil-development-password@localhost:54329/openpencil',
  authSecret: 'browser-e2e-secret-at-least-32-characters',
  s3Endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:8333',
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Bucket: process.env.S3_BUCKET ?? 'openpencil',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'openpencil',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'openpencil-development-secret',
  s3ForcePathStyle: true,
  s3ChecksumVerification: 'metadata'
})

function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('base64')
}

const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
const objects = createS3ObjectStore(config)
const auth = createCloudAuth(config, database)
await migrateCloudDatabase(database, auth)

const workspaceId = crypto.randomUUID()
const documentId = crypto.randomUUID()
const revisionId = crypto.randomUUID()
const objectId = crypto.randomUUID()
const objectKey = `browser-e2e/${documentId}/${revisionId}.fig`
const fixturePath = resolve(import.meta.dir, '../../../../tests/fixtures/gold-preview.fig')
const fixture = new Uint8Array(await readFile(fixturePath))
const fixtureChecksum = checksum(fixture)

await database
  .insertInto('user')
  .values(
    Object.values(cloudE2EActors).map((actor) => ({
      id: actor.userId,
      name: actor.name,
      email: actor.email,
      emailVerified: true,
      image: null
    }))
  )
  .execute()
await database
  .insertInto('workspace')
  .values({
    id: workspaceId,
    name: 'Cloud browser E2E',
    slug: `cloud-browser-e2e-${workspaceId}`,
    createdBy: cloudE2EActors.owner.userId
  })
  .execute()
await database
  .insertInto('workspaceMember')
  .values({ workspaceId, userId: cloudE2EActors.owner.userId, role: 'admin' })
  .execute()
await database
  .insertInto('document')
  .values({
    id: documentId,
    workspaceId,
    name: 'Cloud sharing fixture',
    currentRevisionId: null,
    createdBy: cloudE2EActors.owner.userId
  })
  .execute()
await database
  .insertInto('storageObject')
  .values({
    id: objectId,
    objectKey,
    checksum: fixtureChecksum,
    byteSize: fixture.byteLength,
    contentType: 'application/octet-stream'
  })
  .execute()
await database
  .insertInto('documentRevision')
  .values({
    id: revisionId,
    documentId,
    parentRevisionId: null,
    storageObjectId: objectId,
    createdBy: cloudE2EActors.owner.userId
  })
  .execute()

await database
  .updateTable('document')
  .set({ currentRevisionId: revisionId })
  .where('id', '=', documentId)
  .execute()

const upload = await objects.createUpload({
  key: objectKey,
  byteSize: fixture.byteLength,
  checksum: fixtureChecksum,
  contentType: 'application/octet-stream',
  expiresAt: new Date(Date.now() + 5 * 60_000)
})
if (upload.kind !== 'single') throw new Error('Browser E2E fixture unexpectedly used multipart')
const uploaded = await fetch(upload.url, {
  method: upload.method,
  headers: upload.headers,
  body: fixture
})
if (!uploaded.ok) throw new Error(`Browser E2E fixture upload failed with HTTP ${uploaded.status}`)

const app = createCloudApp({
  config,
  database,
  auth,
  objects,
  resolveSession: createCloudE2ESessionResolver()
})
const server = Bun.serve({ hostname: '127.0.0.1', port, fetch: app.fetch })

console.log(
  `OPENPENCIL_CLOUD_E2E_READY ${JSON.stringify({ serverURL: config.publicURL, workspaceId, documentId })}`
)

async function stop() {
  await server.stop()
  await database.destroy()
  process.exit(0)
}

process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
