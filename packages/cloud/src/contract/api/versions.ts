import { oc } from '@orpc/contract'
import * as v from 'valibot'

import { documentSummarySchema } from '../documents'
import {
  documentVersionDownloadSchema,
  documentVersionResponseSchema,
  documentVersionsSchema,
  duplicateDocumentVersionSchema,
  restoredDocumentSchema,
  saveDocumentVersionSchema,
  updateDocumentVersionSchema
} from '../versions'
import { DOCUMENT_ERRORS } from './errors'
import { documentParamsSchema, documentVersionParamsSchema } from './params'
import { at } from './route'

const route = oc.errors(DOCUMENT_ERRORS)

/** A page of the history: versions older than `before`, at most `limit` of them. */
const versionPageQuerySchema = v.object({
  before: v.optional(v.pipe(v.string(), v.uuid())),
  limit: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)))
})

/** A document's version history: listing, naming, opening, restoring, and duplicating versions. */
export const versionsContract = {
  list: route
    .meta(at('GET', '/documents/{documentId}/versions'))
    .input(v.object({ params: documentParamsSchema, query: versionPageQuerySchema }))
    .output(documentVersionsSchema),
  save: route
    .meta(at('POST', '/documents/{documentId}/versions', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: saveDocumentVersionSchema }))
    .output(documentVersionResponseSchema),
  update: route
    .meta(at('PATCH', '/documents/{documentId}/versions/{versionId}'))
    .input(v.object({ params: documentVersionParamsSchema, body: updateDocumentVersionSchema }))
    .output(documentVersionResponseSchema),
  download: route
    .meta(at('GET', '/documents/{documentId}/versions/{versionId}'))
    .input(v.object({ params: documentVersionParamsSchema }))
    .output(documentVersionDownloadSchema),
  restore: route
    .meta(at('POST', '/documents/{documentId}/versions/{versionId}/restore'))
    .input(v.object({ params: documentVersionParamsSchema }))
    .output(restoredDocumentSchema),
  duplicate: route
    .meta(
      at('POST', '/documents/{documentId}/versions/{versionId}/duplicate', { successStatus: 201 })
    )
    .input(v.object({ params: documentVersionParamsSchema, body: duplicateDocumentVersionSchema }))
    .output(v.object({ document: documentSummarySchema }))
}
