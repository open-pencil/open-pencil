import * as v from 'valibot'

const checksumSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9+/]{43}=$/))

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

export const createDocumentSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255))
})
export type CreateDocumentInput = v.InferOutput<typeof createDocumentSchema>

export const createUploadSchema = v.object({
  baseRevisionId: v.nullable(v.pipe(v.string(), v.uuid())),
  byteSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500 * 1024 * 1024)),
  checksum: checksumSchema,
  contentType: v.literal('application/octet-stream')
})
export type CreateUploadInput = v.InferOutput<typeof createUploadSchema>

export const commitUploadSchema = v.object({
  checksum: checksumSchema
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
