import * as v from 'valibot'

import { documentSummarySchema } from './documents'

/** How long a version's name may be; the history list shows the start of longer ones. */
export const DOCUMENT_VERSION_NAME_MAX_LENGTH = 100
export const DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH = 1000

/** A checkpoint the server kept on its own, or a version someone named. */
export const documentVersionKindSchema = v.picklist(['checkpoint', 'named'])
export type DocumentVersionKind = v.InferOutput<typeof documentVersionKindSchema>

export const documentVersionSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  revisionId: v.pipe(v.string(), v.uuid()),
  kind: documentVersionKindSchema,
  name: v.nullable(v.string()),
  description: v.nullable(v.string()),
  createdAt: v.string(),
  /** Who made the version: the author of a checkpoint's save, or who named or restored it. */
  createdBy: v.object({ id: v.string(), name: v.nullable(v.string()) }),
  /** The version this one restored, while that version is still in the history. */
  restoredFromVersionId: v.nullable(v.pipe(v.string(), v.uuid())),
  /** Whether the document holds this version now. */
  current: v.boolean()
})
export type DocumentVersion = v.InferOutput<typeof documentVersionSchema>

export const documentVersionsSchema = v.object({
  versions: v.array(documentVersionSchema),
  /** Pass as `before` for the next, older page; null on the last one. */
  nextCursor: v.nullable(v.pipe(v.string(), v.uuid()))
})
export type DocumentVersions = v.InferOutput<typeof documentVersionsSchema>

const versionName = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(DOCUMENT_VERSION_NAME_MAX_LENGTH)
)
const versionDescription = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(DOCUMENT_VERSION_DESCRIPTION_MAX_LENGTH)
)

/** Names the document as it is now, like Save to version history. */
export const saveDocumentVersionSchema = v.object({
  name: versionName,
  description: v.optional(versionDescription, '')
})
export type SaveDocumentVersionInput = v.InferOutput<typeof saveDocumentVersionSchema>

/** Names a version or changes its name; a null name deletes its info and leaves a checkpoint. */
export const updateDocumentVersionSchema = v.object({
  name: v.nullable(versionName),
  description: v.optional(versionDescription, '')
})
export type UpdateDocumentVersionInput = v.InferOutput<typeof updateDocumentVersionSchema>

export const duplicateDocumentVersionSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255))
})
export type DuplicateDocumentVersionInput = v.InferOutput<typeof duplicateDocumentVersionSchema>

export const documentVersionResponseSchema = v.object({ version: documentVersionSchema })
export const restoredDocumentSchema = v.object({
  document: documentSummarySchema,
  version: documentVersionSchema
})

export function parseSaveDocumentVersion(input: unknown): SaveDocumentVersionInput {
  return v.parse(saveDocumentVersionSchema, input)
}
export function parseUpdateDocumentVersion(input: unknown): UpdateDocumentVersionInput {
  return v.parse(updateDocumentVersionSchema, input)
}
export function parseDuplicateDocumentVersion(input: unknown): DuplicateDocumentVersionInput {
  return v.parse(duplicateDocumentVersionSchema, input)
}
