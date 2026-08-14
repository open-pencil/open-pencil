import type { CloudServerConfig } from '#cloud/server'
import type { ObjectStore } from '#cloud/server/objects'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl as getSignedURL } from '@aws-sdk/s3-request-presigner'

const CHECKSUM_METADATA_KEY = 'openpencil-sha256'
const READINESS_BODY = new TextEncoder().encode('openpencil-ready')
const READINESS_CHECKSUM = 'Hq6g3mmWpyBNobXoWZIz/d0/d8KLjJyEKqNnJh6KXjA='
const MULTIPART_THRESHOLD = 32 * 1024 * 1024
const MULTIPART_PART_SIZE = 16 * 1024 * 1024
const MAX_MULTIPART_PARTS = 10_000

type S3ErrorMetadata = {
  $metadata?: {
    httpStatusCode?: number
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    '$metadata' in error &&
    (error as S3ErrorMetadata).$metadata?.httpStatusCode === 404
  )
}

function encryption(config: CloudServerConfig) {
  return config.s3ServerSideEncryption
    ? {
        ServerSideEncryption: config.s3ServerSideEncryption,
        ...(config.s3KmsKeyId ? { SSEKMSKeyId: config.s3KmsKeyId } : {})
      }
    : {}
}

export function createS3ObjectStore(config: CloudServerConfig): ObjectStore {
  const client = new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    forcePathStyle: config.s3ForcePathStyle,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      ...(config.s3SessionToken ? { sessionToken: config.s3SessionToken } : {})
    }
  })
  const nativeSHA256 = config.s3ChecksumVerification === 'native'

  async function headObject(key: string) {
    return client.send(
      new HeadObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        ...(nativeSHA256 ? { ChecksumMode: 'ENABLED' as const } : {})
      })
    )
  }

  return {
    capabilities: {
      nativeSHA256,
      multipartUpload: true,
      conditionalWrites: false
    },

    async checkReadiness() {
      const key = `.openpencil/readiness/${crypto.randomUUID()}`
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.s3Bucket,
            Key: key,
            Body: READINESS_BODY,
            ContentType: 'application/octet-stream',
            ChecksumSHA256: nativeSHA256 ? READINESS_CHECKSUM : undefined,
            Metadata: { [CHECKSUM_METADATA_KEY]: READINESS_CHECKSUM },
            ...encryption(config)
          })
        )
        const object = await headObject(key)
        const checksum = nativeSHA256
          ? object.ChecksumSHA256
          : object.Metadata?.[CHECKSUM_METADATA_KEY]
        return {
          ok: object.ContentLength === READINESS_BODY.byteLength && checksum === READINESS_CHECKSUM,
          checksumVerification: nativeSHA256 ? 'native' : 'metadata'
        }
      } finally {
        await client.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }))
      }
    },

    async createDownload(input) {
      const expiresIn = Math.max(1, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000))
      const url = await getSignedURL(
        client,
        new GetObjectCommand({ Bucket: config.s3Bucket, Key: input.key }),
        { expiresIn }
      )
      return {
        url,
        method: 'GET',
        headers: {},
        expiresAt: input.expiresAt.toISOString()
      }
    },

    async createUpload(input) {
      if (input.byteSize > MULTIPART_THRESHOLD) {
        const created = await client.send(
          new CreateMultipartUploadCommand({
            Bucket: config.s3Bucket,
            Key: input.key,
            ContentType: input.contentType,
            Metadata: { [CHECKSUM_METADATA_KEY]: input.checksum },
            ...encryption(config)
          })
        )
        if (!created.UploadId) throw new Error('S3 did not return a multipart upload ID')
        const partCount = Math.ceil(input.byteSize / MULTIPART_PART_SIZE)
        if (partCount > MAX_MULTIPART_PARTS) throw new Error('Object requires too many S3 parts')
        const expiresIn = Math.max(1, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000))
        const parts = await Promise.all(
          Array.from({ length: partCount }, async (_, index) => {
            const partNumber = index + 1
            return {
              partNumber,
              url: await getSignedURL(
                client,
                new UploadPartCommand({
                  Bucket: config.s3Bucket,
                  Key: input.key,
                  UploadId: created.UploadId,
                  PartNumber: partNumber
                }),
                { expiresIn }
              ),
              method: 'PUT' as const,
              headers: {}
            }
          })
        )
        return {
          kind: 'multipart',
          uploadId: created.UploadId,
          partSize: MULTIPART_PART_SIZE,
          parts,
          expiresAt: input.expiresAt.toISOString()
        }
      }
      const expiresIn = Math.max(1, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000))
      const command = new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: input.key,
        ContentType: input.contentType,
        ChecksumSHA256: nativeSHA256 ? input.checksum : undefined,
        Metadata: { [CHECKSUM_METADATA_KEY]: input.checksum },
        ...encryption(config)
      })
      const url = await getSignedURL(client, command, {
        expiresIn,
        unhoistableHeaders: new Set([
          ...(nativeSHA256 ? ['x-amz-checksum-sha256'] : []),
          `x-amz-meta-${CHECKSUM_METADATA_KEY}`
        ])
      })
      return {
        kind: 'single',
        url,
        method: 'PUT',
        headers: {
          'Content-Type': input.contentType,
          ...(nativeSHA256 ? { 'x-amz-checksum-sha256': input.checksum } : {}),
          [`x-amz-meta-${CHECKSUM_METADATA_KEY}`]: input.checksum
        },
        expiresAt: input.expiresAt.toISOString()
      }
    },

    async completeUpload(input) {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: config.s3Bucket,
          Key: input.key,
          UploadId: input.uploadId,
          MultipartUpload: {
            Parts: input.parts.map((part) => ({ ETag: part.etag, PartNumber: part.partNumber }))
          }
        })
      )
    },

    async abortUpload(input) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: config.s3Bucket,
          Key: input.key,
          UploadId: input.uploadId
        })
      )
    },

    async head(key) {
      try {
        const object = await headObject(key)
        const checksum = nativeSHA256
          ? object.ChecksumSHA256
          : object.Metadata?.[CHECKSUM_METADATA_KEY]
        if (object.ContentLength == null || !checksum || !object.ContentType) return null
        return {
          byteSize: object.ContentLength,
          checksum,
          checksumVerification: nativeSHA256 ? 'native' : 'metadata',
          contentType: object.ContentType
        }
      } catch (error) {
        if (isNotFoundError(error)) return null
        throw error
      }
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }))
    }
  }
}
