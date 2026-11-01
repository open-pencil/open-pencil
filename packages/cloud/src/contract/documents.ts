import * as v from 'valibot'

export const CLOUD_PROTOCOL_MAX_UPLOAD_BYTES = 1024 * 1024 * 1024

const checksumSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9+/]{43}=$/))

/** Whether a value is a SHA-256 checksum as the server names stored objects, base64 encoded. */
export function isCloudChecksum(value: string): boolean {
  return v.is(checksumSchema, value)
}

/** The most images one revision, or one request for image uploads, may name. */
export const CLOUD_MAX_DOCUMENT_IMAGES = 10_000

/**
 * An image's name inside a `.fig` file that Cloud stores apart from it: the SHA-1 Figma names it
 * by, or an older plain name. A client leaves images under other names inside the file.
 */
export const CLOUD_IMAGE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const imageNameSchema = v.pipe(v.string(), v.regex(CLOUD_IMAGE_NAME_PATTERN))

const objectDownloadSchema = v.object({
  url: v.pipe(v.string(), v.url()),
  method: v.literal('GET'),
  headers: v.record(v.string(), v.string()),
  expiresAt: v.string()
})

/** An image a stored revision uses, where to download it, and what to check it against. */
export const documentImageDownloadSchema = v.object({
  name: imageNameSchema,
  checksum: checksumSchema,
  byteSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
  download: objectDownloadSchema
})
export type DocumentImageDownload = v.InferOutput<typeof documentImageDownloadSchema>

/** Where to download an image a document uses, found by its checksum. */
export const documentImageLinkSchema = v.object({
  checksum: checksumSchema,
  byteSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
  download: objectDownloadSchema
})
export type DocumentImageLink = v.InferOutput<typeof documentImageLinkSchema>

/** The images a live room names, by checksum, that a peer needs links for. */
export const requestImageLinksSchema = v.object({
  checksums: v.pipe(v.array(checksumSchema), v.minLength(1), v.maxLength(CLOUD_MAX_DOCUMENT_IMAGES))
})
export type RequestImageLinksInput = v.InferOutput<typeof requestImageLinksSchema>

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

/** What a document is: a Figma design or a FigJam board, which the file it stores says too. */
export const documentKindSchema = v.picklist(['design', 'board'])
export type CloudDocumentKind = v.InferOutput<typeof documentKindSchema>

export const documentSummarySchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  workspaceId: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  /** A design unless said otherwise; servers from before boards list no kind. */
  kind: v.optional(documentKindSchema, 'design'),
  currentRevisionId: v.nullable(v.pipe(v.string(), v.uuid())),
  version: v.number(),
  createdAt: v.string(),
  updatedAt: v.string()
})
export type DocumentSummary = v.InferOutput<typeof documentSummarySchema>

/** A document someone granted the person directly, in a workspace they are not a member of. */
export const sharedDocumentSchema = v.object({
  ...documentSummarySchema.entries,
  workspaceName: v.string(),
  permission: documentPermissionSchema,
  sharedBy: v.nullable(v.object({ name: v.string() })),
  sharedAt: v.string()
})
export type SharedDocument = v.InferOutput<typeof sharedDocumentSchema>

export const documentDownloadSchema = v.object({
  document: documentSummarySchema,
  revisionId: v.pipe(v.string(), v.uuid()),
  byteSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
  checksum: checksumSchema,
  contentType: v.string(),
  download: objectDownloadSchema,
  /** The images the stored file leaves out, which a client puts back under their names. */
  images: v.pipe(v.array(documentImageDownloadSchema), v.maxLength(CLOUD_MAX_DOCUMENT_IMAGES))
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

export const CLOUD_DOCUMENT_NAME_MAX_LENGTH = 255

export const createDocumentSchema = v.object({
  id: v.optional(v.pipe(v.string(), v.uuid())),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(CLOUD_DOCUMENT_NAME_MAX_LENGTH)),
  /** A design unless said otherwise; older clients create only designs. */
  kind: v.optional(documentKindSchema, 'design')
})
export type CreateDocumentInput = v.InferOutput<typeof createDocumentSchema>
/** A new document as a client sends it, which may leave out its kind to make a design. */
export type CreateDocumentRequest = v.InferInput<typeof createDocumentSchema>

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

const imageSizeSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(CLOUD_PROTOCOL_MAX_UPLOAD_BYTES)
)

/** Where a client puts an object: one presigned PUT, or the parts of a multipart upload. */
export const objectUploadSchema = v.variant('kind', [
  v.object({
    kind: v.literal('single'),
    url: v.pipe(v.string(), v.url()),
    method: v.literal('PUT'),
    headers: v.record(v.string(), v.string()),
    expiresAt: v.string()
  }),
  v.object({
    kind: v.literal('multipart'),
    uploadId: v.string(),
    partSize: v.pipe(v.number(), v.integer(), v.minValue(1)),
    parts: v.array(
      v.object({
        partNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
        url: v.pipe(v.string(), v.url()),
        method: v.literal('PUT'),
        headers: v.record(v.string(), v.string())
      })
    ),
    expiresAt: v.string()
  })
])
export type ObjectUploadTarget = v.InferOutput<typeof objectUploadSchema>

/** An upload the server offers for an image the workspace lacks. */
export const imageUploadOfferSchema = v.object({
  checksum: checksumSchema,
  uploadId: v.pipe(v.string(), v.uuid()),
  upload: objectUploadSchema
})
export type ImageUploadOffer = v.InferOutput<typeof imageUploadOfferSchema>

/** The images a save will refer to; the server answers with uploads for those it lacks. */
export const requestImageUploadsSchema = v.object({
  images: v.pipe(
    v.array(v.object({ checksum: checksumSchema, byteSize: imageSizeSchema })),
    v.minLength(1),
    v.maxLength(CLOUD_MAX_DOCUMENT_IMAGES)
  )
})
export type RequestImageUploadsInput = v.InferOutput<typeof requestImageUploadsSchema>

export const completedUploadPartSchema = v.object({
  partNumber: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000)),
  etag: v.pipe(v.string(), v.minLength(1), v.maxLength(255))
})

export const commitUploadSchema = v.object({
  checksum: checksumSchema,
  /** The document title captured with this revision; omitted by older clients. */
  name: v.optional(createDocumentSchema.entries.name),
  /** What the uploaded file is, which the document takes; omitted by older clients. */
  kind: v.optional(documentKindSchema),
  multipart: v.optional(
    v.object({
      uploadId: v.pipe(v.string(), v.minLength(1)),
      parts: v.pipe(v.array(completedUploadPartSchema), v.minLength(1), v.maxLength(10_000))
    })
  ),
  /** The images the uploaded file leaves out, each stored in the workspace or uploaded before. */
  images: v.optional(
    v.pipe(
      v.array(v.object({ name: imageNameSchema, checksum: checksumSchema })),
      v.maxLength(CLOUD_MAX_DOCUMENT_IMAGES)
    ),
    []
  )
})
export type CommitUploadInput = v.InferOutput<typeof commitUploadSchema>

/** The image uploads a save asked for, committed together once their bytes are in place. */
export const commitImageUploadsSchema = v.object({
  uploads: v.pipe(
    v.array(
      v.object({
        uploadId: v.pipe(v.string(), v.uuid()),
        checksum: checksumSchema,
        multipart: commitUploadSchema.entries.multipart
      })
    ),
    v.minLength(1),
    v.maxLength(CLOUD_MAX_DOCUMENT_IMAGES)
  )
})
export type CommitImageUploadsInput = v.InferOutput<typeof commitImageUploadsSchema>
/** A commit as a client sends it, which may leave out the images a whole file holds itself. */
export type CommitUploadRequest = v.InferInput<typeof commitUploadSchema>

export function parseCreateDocument(input: unknown): CreateDocumentInput {
  return v.parse(createDocumentSchema, input)
}

export function parseCreateUpload(input: unknown): CreateUploadInput {
  return v.parse(createUploadSchema, input)
}

export function parseRequestImageUploads(input: unknown): RequestImageUploadsInput {
  return v.parse(requestImageUploadsSchema, input)
}

export function parseCommitImageUploads(input: unknown): CommitImageUploadsInput {
  return v.parse(commitImageUploadsSchema, input)
}

export function parseRequestImageLinks(input: unknown): RequestImageLinksInput {
  return v.parse(requestImageLinksSchema, input)
}

export function parseCommitUpload(input: unknown): CommitUploadInput {
  return v.parse(commitUploadSchema, input)
}
