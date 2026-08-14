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

export function createS3ObjectStore(config: CloudServerConfig): ObjectStore {
  const client = new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    }
  })

  return {
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
        ChecksumSHA256: input.checksum
      })
      const url = await getSignedURL(client, command, {
        expiresIn,
        unhoistableHeaders: new Set(['x-amz-checksum-sha256'])
      })
      return {
        url,
        method: 'PUT',
        headers: {
          'Content-Type': input.contentType,
          'x-amz-checksum-sha256': input.checksum
        },
        expiresAt: input.expiresAt.toISOString()
      }
    },

    async head(key) {
      try {
        const object = await client.send(
          new HeadObjectCommand({
            Bucket: config.s3Bucket,
            Key: key,
            ChecksumMode: 'ENABLED'
          })
        )
        if (object.ContentLength == null || !object.ChecksumSHA256 || !object.ContentType)
          return null
        return {
          byteSize: object.ContentLength,
          checksum: object.ChecksumSHA256,
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
