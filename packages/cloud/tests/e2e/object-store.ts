import { createHash } from 'node:crypto'

import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'

import { createS3ObjectStore } from '@open-pencil/cloud/runtime/node'
import { parseCloudServerConfig } from '@open-pencil/cloud/server'

const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:8333'
const bucket = process.env.S3_BUCKET ?? 'openpencil-smoke'
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? 'openpencil'
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? 'openpencil-development-secret'
const provider = process.env.S3_COMPAT_PROVIDER ?? 'S3-compatible storage'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://openpencil:openpencil-development-password@localhost/openpencil',
  authSecret: 'object-store-smoke-secret-at-least-32-characters',
  s3Endpoint: endpoint,
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Bucket: bucket,
  s3AccessKeyId: accessKeyId,
  s3SecretAccessKey: secretAccessKey,
  s3ForcePathStyle: true,
  s3ChecksumVerification: 'metadata'
})

const client = new S3Client({
  endpoint,
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey }
})
try {
  await client.send(new CreateBucketCommand({ Bucket: bucket }))
} catch (error) {
  const name = error instanceof Error ? error.name : ''
  if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw error
}

const store = createS3ObjectStore(config)
const readiness = await store.checkReadiness()
if (!readiness.ok || readiness.checksumVerification !== 'metadata') {
  throw new Error(`Unexpected object-store readiness: ${JSON.stringify(readiness)}`)
}

const singleBytes = new TextEncoder().encode(`OpenPencil Cloud ${provider} smoke`)
const singleChecksum = createHash('sha256').update(singleBytes).digest('base64')
const singleKey = `smoke/${crypto.randomUUID()}-single.fig`
const singleUpload = await store.createUpload({
  key: singleKey,
  byteSize: singleBytes.byteLength,
  checksum: singleChecksum,
  contentType: 'application/octet-stream',
  expiresAt: new Date(Date.now() + 10 * 60 * 1000)
})
if (singleUpload.kind !== 'single') throw new Error('Expected single-part upload')
const singleResponse = await fetch(singleUpload.url, {
  method: singleUpload.method,
  headers: singleUpload.headers,
  body: singleBytes
})
if (!singleResponse.ok) throw new Error(`Single upload failed: ${singleResponse.status}`)
const singleStored = await store.head(singleKey)
if (
  !singleStored ||
  singleStored.byteSize !== singleBytes.byteLength ||
  singleStored.checksum !== singleChecksum
) {
  throw new Error(`Single object verification failed: ${JSON.stringify(singleStored)}`)
}
await store.delete(singleKey)

const byteSize = 33 * 1024 * 1024
const bytes = new Uint8Array(byteSize)
for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251
const checksum = createHash('sha256').update(bytes).digest('base64')
const key = `smoke/${crypto.randomUUID()}.fig`
const upload = await store.createUpload({
  key,
  byteSize,
  checksum,
  contentType: 'application/octet-stream',
  expiresAt: new Date(Date.now() + 10 * 60 * 1000)
})
if (upload.kind !== 'multipart') throw new Error('Expected multipart upload')

const parts = []
for (const part of upload.parts) {
  const start = (part.partNumber - 1) * upload.partSize
  const end = Math.min(bytes.length, start + upload.partSize)
  const response = await fetch(part.url, {
    method: part.method,
    headers: part.headers,
    body: Uint8Array.from(bytes.subarray(start, end))
  })
  if (!response.ok) throw new Error(`Part ${part.partNumber} failed: ${response.status}`)
  const etag = response.headers.get('etag')
  if (!etag) throw new Error(`Part ${part.partNumber} did not return an ETag`)
  parts.push({ partNumber: part.partNumber, etag })
}
await store.completeUpload({ key, uploadId: upload.uploadId, parts })
const stored = await store.head(key)
if (!stored || stored.byteSize !== byteSize || stored.checksum !== checksum) {
  throw new Error(`Stored object verification failed: ${JSON.stringify(stored)}`)
}
const download = await store.createDownload({
  key,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000)
})
const downloadResponse = await fetch(download.url, {
  method: download.method,
  headers: download.headers
})
if (!downloadResponse.ok) throw new Error(`Download failed: ${downloadResponse.status}`)
const downloadedChecksum = createHash('sha256')
  .update(new Uint8Array(await downloadResponse.arrayBuffer()))
  .digest('base64')
if (downloadedChecksum !== checksum) throw new Error('Downloaded object checksum did not match')
await store.delete(key)
console.log(
  `${provider} smoke passed (single PUT, ${parts.length} multipart parts, verified GET, ${byteSize} bytes)`
)
