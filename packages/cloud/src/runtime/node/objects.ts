import type { CloudServerConfig } from '#cloud/server'
import type { ObjectStore } from '#cloud/server/objects'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl as getSignedURL } from '@aws-sdk/s3-request-presigner'

const CHECKSUM_METADATA_KEY = 'openpencil-sha256'
const READINESS_BODY = new TextEncoder().encode('openpencil-ready')
const READINESS_CHECKSUM = 'Hq6g3mmWpyBNobXoWZIz/d0/d8KLjJyEKqNnJh6KXjA='

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
      multipartUpload: false,
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
        if (
          typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        ) {
          return null
        }
        throw error
      }
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }))
    }
  }
}
