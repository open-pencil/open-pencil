import { CLOUD_PROTOCOL_MAX_UPLOAD_BYTES } from '#cloud/server/config/limits'
import * as v from 'valibot'

const checksumSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9+/]{43}=$/))

export const documentPermissionSchema = v.picklist(['view', 'edit'])
export type DocumentPermission = v.InferOutput<typeof documentPermissionSchema>

export const documentAccessSourceSchema = v.picklist(['owner', 'workspace', 'direct-grant'])
export type DocumentAccessSource = v.InferOutput<typeof documentAccessSourceSchema>

export const documentAccessSchema = v.object({
  permission: documentPermissionSchema,
  canManageSharing: v.boolean(),
  sources: v.array(documentAccessSourceSchema)
})
export type DocumentAccess = v.InferOutput<typeof documentAccessSchema>

export const documentSummarySchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  workspaceId: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  currentRevisionId: v.nullable(v.pipe(v.string(), v.uuid())),
  version: v.number(),
  createdAt: v.string(),
  updatedAt: v.string()
})
export type DocumentSummary = v.InferOutput<typeof documentSummarySchema>

export const documentDownloadSchema = v.object({
  document: documentSummarySchema,
  revisionId: v.pipe(v.string(), v.uuid()),
  byteSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
  checksum: checksumSchema,
  contentType: v.string(),
  download: v.object({
    url: v.pipe(v.string(), v.url()),
    method: v.literal('GET'),
    headers: v.record(v.string(), v.string()),
    expiresAt: v.string()
  })
})
export type DocumentDownload = v.InferOutput<typeof documentDownloadSchema>

export const cloudActorSchema = v.object({
  userId: v.string(),
  email: v.pipe(v.string(), v.email()),
  name: v.string()
})
export type CloudActorContract = v.InferOutput<typeof cloudActorSchema>

export const cloudSessionSchema = v.object({ user: cloudActorSchema })
export type CloudSession = v.InferOutput<typeof cloudSessionSchema>

export const workspaceUsageSchema = v.object({
  bytesUsed: v.pipe(v.number(), v.integer(), v.minValue(0)),
  objectCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  documentCount: v.pipe(v.number(), v.integer(), v.minValue(0))
})
export type WorkspaceUsage = v.InferOutput<typeof workspaceUsageSchema>

export const createDocumentSchema = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255))
})
export type CreateDocumentInput = v.InferOutput<typeof createDocumentSchema>

export const createUploadSchema = v.object({
  baseRevisionId: v.nullable(v.pipe(v.string(), v.uuid())),
  byteSize: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(CLOUD_PROTOCOL_MAX_UPLOAD_BYTES)
  ),
  checksum: checksumSchema,
  contentType: v.literal('application/octet-stream')
})
export type CreateUploadInput = v.InferOutput<typeof createUploadSchema>

export const completedUploadPartSchema = v.object({
  partNumber: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000)),
  etag: v.pipe(v.string(), v.minLength(1), v.maxLength(255))
})

export const commitUploadSchema = v.object({
  checksum: checksumSchema,
  multipart: v.optional(
    v.object({
      uploadId: v.pipe(v.string(), v.minLength(1)),
      parts: v.pipe(v.array(completedUploadPartSchema), v.minLength(1), v.maxLength(10_000))
    })
  )
})
export type CommitUploadInput = v.InferOutput<typeof commitUploadSchema>

export function parseCreateDocument(input: unknown): CreateDocumentInput {
  return v.parse(createDocumentSchema, input)
}

export function parseCreateUpload(input: unknown): CreateUploadInput {
  return v.parse(createUploadSchema, input)
}

export function parseCommitUpload(input: unknown): CommitUploadInput {
  return v.parse(commitUploadSchema, input)
}
