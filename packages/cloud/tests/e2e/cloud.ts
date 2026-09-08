import { createHash } from 'node:crypto'

import {
  CloudAPIError,
  createCloudAPIClient,
  type CloudFetch,
  type CloudUpload
} from '@open-pencil/cloud/client'
import { createNodeCloudDatabase, createS3ObjectStore } from '@open-pencil/cloud/runtime/node'
import {
  createCloudApp,
  createBetterAuthAdapter,
  createDocumentCleanupService,
  createUploadCleanupService,
  migrateCloudDatabase,
  parseCloudServerConfig,
  type CloudActor,
  type CloudApp
} from '@open-pencil/cloud/server'

const actor: CloudActor = {
  userId: `e2e-${crypto.randomUUID()}`,
  email: 'cloud-e2e@example.com',
  name: 'Cloud E2E'
}
const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL:
    process.env.DATABASE_URL ??
    'postgresql://openpencil:openpencil-development-password@localhost:54329/openpencil',
  authSecret: 'full-stack-e2e-secret-at-least-32-characters',
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

async function uploadBytes(upload: CloudUpload['upload'], bytes: Uint8Array) {
  if (upload.kind === 'single') {
    const response = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: bytes
    })
    if (!response.ok) throw new Error(`Single upload failed with HTTP ${response.status}`)
    return undefined
  }
  const parts = []
  for (const part of upload.parts) {
    const start = (part.partNumber - 1) * upload.partSize
    const response = await fetch(part.url, {
      method: part.method,
      headers: part.headers,
      body: bytes.subarray(start, Math.min(bytes.byteLength, start + upload.partSize))
    })
    if (!response.ok) throw new Error(`Part ${part.partNumber} failed with HTTP ${response.status}`)
    const etag = response.headers.get('etag')
    if (!etag) throw new Error(`Part ${part.partNumber} did not return an ETag`)
    parts.push({ partNumber: part.partNumber, etag })
  }
  return { uploadId: upload.uploadId, parts }
}

function appFetch(app: CloudApp): CloudFetch {
  return async (input, init) =>
    app.fetch(input instanceof Request ? input : new Request(input, init))
}

const database = createNodeCloudDatabase({ connectionString: config.databaseURL })
const objects = createS3ObjectStore(config)
try {
  const auth = createBetterAuthAdapter(config, database)
  await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
  const app = createCloudApp({ config, database, auth, objects, resolveSession: async () => actor })
  const ready = await app.request('/ready')
  if (!ready.ok) throw new Error(`Cloud readiness failed with HTTP ${ready.status}`)

  const workspaceResponse = await app.request('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cloud E2E', slug: `cloud-e2e-${crypto.randomUUID()}` })
  })
  if (workspaceResponse.status !== 201) {
    throw new Error(`Workspace creation failed with HTTP ${workspaceResponse.status}`)
  }
  const workspaceBody = (await workspaceResponse.json()) as { workspace: { id: string } }
  const client = createCloudAPIClient('http://localhost:8787/api', { fetch: appFetch(app) })
  const document = await client.createDocument(workspaceBody.workspace.id, {
    id: crypto.randomUUID(),
    name: 'E2E.fig'
  })

  const firstBytes = new TextEncoder().encode('OpenPencil Cloud full-stack E2E revision one')
  const firstChecksum = checksum(firstBytes)
  const firstUpload = await client.createUpload(document.id, {
    baseRevisionId: null,
    byteSize: firstBytes.byteLength,
    checksum: firstChecksum,
    contentType: 'application/octet-stream'
  })
  const firstMultipart = await uploadBytes(firstUpload.upload, firstBytes)
  if (firstMultipart) throw new Error('Expected the first revision to use a single PUT')
  const firstRevision = await client.commitUpload(firstUpload.id, { checksum: firstChecksum })
  if (!firstRevision.currentRevisionId || firstRevision.version !== 1) {
    throw new Error('First revision was not committed')
  }
  const repeated = await client.commitUpload(firstUpload.id, { checksum: firstChecksum })
  if (repeated.currentRevisionId !== firstRevision.currentRevisionId || repeated.version !== 1) {
    throw new Error('Repeated commit was not idempotent')
  }

  try {
    await client.createUpload(document.id, {
      baseRevisionId: null,
      byteSize: firstBytes.byteLength,
      checksum: firstChecksum,
      contentType: 'application/octet-stream'
    })
    throw new Error('Expected a stale revision conflict')
  } catch (error) {
    if (!(error instanceof CloudAPIError) || error.code !== 'revision_conflict') throw error
  }

  const secondBytes = new Uint8Array(33 * 1024 * 1024)
  for (let index = 0; index < secondBytes.byteLength; index++) secondBytes[index] = index % 251
  const secondChecksum = checksum(secondBytes)
  const secondUpload = await client.createUpload(document.id, {
    baseRevisionId: firstRevision.currentRevisionId,
    byteSize: secondBytes.byteLength,
    checksum: secondChecksum,
    contentType: 'application/octet-stream'
  })
  const secondMultipart = await uploadBytes(secondUpload.upload, secondBytes)
  if (!secondMultipart) throw new Error('Expected the second revision to use multipart upload')
  const secondRevision = await client.commitUpload(secondUpload.id, {
    checksum: secondChecksum,
    multipart: secondMultipart
  })
  if (secondRevision.version !== 2) throw new Error('Second revision was not committed')

  const remote = await client.getDocument(document.id)
  const downloaded = await fetch(remote.download.url)
  const downloadedChecksum = checksum(new Uint8Array(await downloaded.arrayBuffer()))
  if (!downloaded.ok || downloadedChecksum !== secondChecksum) {
    throw new Error('Committed revision download did not match its SHA-256')
  }

  const abandonedUploads = await Promise.all(
    Array.from({ length: 3 }, () =>
      client.createUpload(document.id, {
        baseRevisionId: secondRevision.currentRevisionId,
        byteSize: secondBytes.byteLength,
        checksum: secondChecksum,
        contentType: 'application/octet-stream'
      })
    )
  )
  if (abandonedUploads.some((upload) => upload.upload.kind !== 'multipart')) {
    throw new Error('Expected cleanup fixtures to use multipart uploads')
  }
  const cleanupOptions = {
    batchSize: 2,
    leaseDurationMs: 5 * 60 * 1000,
    now: new Date(Date.now() + 16 * 60 * 1000)
  }
  const cleanupWorkers = [
    createUploadCleanupService(database, objects),
    createUploadCleanupService(database, objects)
  ]
  const cleanupResults = await Promise.all(
    cleanupWorkers.map((cleanup) => cleanup.cleanupExpiredUploads(cleanupOptions))
  )
  if (
    cleanupResults.reduce((total, result) => total + result.claimed, 0) !== 3 ||
    cleanupResults.reduce((total, result) => total + result.cleaned, 0) !== 3 ||
    cleanupResults.some((result) => result.failed !== 0)
  ) {
    throw new Error(
      `Concurrent cleanup returned unexpected results: ${JSON.stringify(cleanupResults)}`
    )
  }

  const usage = await client.getUsage(workspaceBody.workspace.id)
  if (
    usage.documentCount !== 1 ||
    usage.objectCount !== 1 ||
    usage.bytesUsed !== secondBytes.byteLength
  ) {
    throw new Error(`Unexpected workspace usage: ${JSON.stringify(usage)}`)
  }
  await client.deleteDocument(document.id)
  if ((await client.listDocuments(workspaceBody.workspace.id)).length !== 0) {
    throw new Error('Soft-deleted document remained in the workspace listing')
  }
  const documentCleanup = await createDocumentCleanupService(
    database,
    objects
  ).cleanupDeletedDocuments({
    batchSize: 1,
    leaseDurationMs: 5 * 60 * 1000,
    retentionMs: 0
  })
  if (
    documentCleanup.cleaned !== 1 ||
    documentCleanup.objectsDeleted !== 2 ||
    documentCleanup.bytesReclaimed !== firstBytes.byteLength + secondBytes.byteLength
  ) {
    throw new Error(
      `Document cleanup returned unexpected results: ${JSON.stringify(documentCleanup)}`
    )
  }
  if (
    await database
      .selectFrom('document')
      .select('id')
      .where('id', '=', document.id)
      .executeTakeFirst()
  ) {
    throw new Error('Retained document metadata was not removed')
  }
  console.log('Cloud full-stack E2E passed (PostgreSQL, single PUT, multipart, conflict, cleanup)')
} finally {
  await database.destroy()
}
