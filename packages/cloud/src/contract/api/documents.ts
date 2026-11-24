import { oc, type ErrorMap } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import * as v from 'valibot'

import {
  commitImageUploadsSchema,
  commitUploadSchema,
  createDocumentSchema,
  createUploadSchema,
  documentAccessSchema,
  documentDownloadSchema,
  documentImageLinkSchema,
  documentSummarySchema,
  imageUploadOfferSchema,
  objectUploadSchema,
  requestImageLinksSchema,
  requestImageUploadsSchema,
  sharedDocumentSchema,
  trashSchema,
  workspaceUsageSchema
} from '../documents'
import { documentParamsSchema, uploadParamsSchema, workspaceParamsSchema } from './params'

/** What any document route may answer besides its result. */
const DOCUMENT_ERRORS = {
  not_found: {},
  forbidden: {},
  revision_conflict: {},
  storage_quota_exceeded: {},
  invalid_upload: {},
  purge_failed: {}
} satisfies ErrorMap

const route = oc.errors(DOCUMENT_ERRORS)

const documentResultSchema = v.object({ document: documentSummarySchema })

/** Documents: listing and creating them, Trash, downloads, uploads, and their images. */
export const documentsContract = {
  listShared: route
    .meta(openapi({ method: 'GET', path: '/shared-documents' }))
    .output(v.object({ documents: v.array(sharedDocumentSchema) })),
  listTrash: route.meta(openapi({ method: 'GET', path: '/trash' })).output(trashSchema),
  restore: route
    .meta(
      openapi({
        method: 'POST',
        path: '/trash/{documentId}/restore',
        inputStructure: 'detailed',
        successStatus: 204
      })
    )
    .input(v.object({ params: documentParamsSchema })),
  purge: route
    .meta(
      openapi({
        method: 'DELETE',
        path: '/trash/{documentId}',
        inputStructure: 'detailed',
        successStatus: 204
      })
    )
    .input(v.object({ params: documentParamsSchema })),
  list: route
    .meta(
      openapi({
        method: 'GET',
        path: '/workspaces/{workspaceId}/documents',
        inputStructure: 'detailed'
      })
    )
    .input(v.object({ params: workspaceParamsSchema }))
    .output(v.object({ documents: v.array(documentSummarySchema) })),
  usage: route
    .meta(
      openapi({
        method: 'GET',
        path: '/workspaces/{workspaceId}/usage',
        inputStructure: 'detailed'
      })
    )
    .input(v.object({ params: workspaceParamsSchema }))
    .output(v.object({ usage: workspaceUsageSchema })),
  create: route
    .meta(
      openapi({
        method: 'POST',
        path: '/workspaces/{workspaceId}/documents',
        inputStructure: 'detailed',
        successStatus: 201
      })
    )
    .input(v.object({ params: workspaceParamsSchema, body: createDocumentSchema }))
    .output(documentResultSchema),
  remove: route
    .meta(
      openapi({
        method: 'DELETE',
        path: '/documents/{documentId}',
        inputStructure: 'detailed',
        successStatus: 204
      })
    )
    .input(v.object({ params: documentParamsSchema })),
  access: route
    .meta(
      openapi({ method: 'GET', path: '/documents/{documentId}/access', inputStructure: 'detailed' })
    )
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ access: documentAccessSchema })),
  download: route
    .meta(openapi({ method: 'GET', path: '/documents/{documentId}', inputStructure: 'detailed' }))
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ document: documentDownloadSchema })),
  createUpload: route
    .meta(
      openapi({
        method: 'POST',
        path: '/documents/{documentId}/uploads',
        inputStructure: 'detailed',
        successStatus: 201
      })
    )
    .input(v.object({ params: documentParamsSchema, body: createUploadSchema }))
    .output(v.object({ id: v.pipe(v.string(), v.uuid()), upload: objectUploadSchema })),
  commitUpload: route
    .meta(
      openapi({ method: 'POST', path: '/uploads/{uploadId}/commit', inputStructure: 'detailed' })
    )
    .input(v.object({ params: uploadParamsSchema, body: commitUploadSchema }))
    .output(documentResultSchema),
  requestImageUploads: route
    .meta(
      openapi({
        method: 'POST',
        path: '/documents/{documentId}/images',
        inputStructure: 'detailed',
        successStatus: 201
      })
    )
    .input(v.object({ params: documentParamsSchema, body: requestImageUploadsSchema }))
    .output(v.object({ uploads: v.array(imageUploadOfferSchema) })),
  commitImageUploads: route
    .meta(
      openapi({
        method: 'POST',
        path: '/documents/{documentId}/images/commit',
        inputStructure: 'detailed',
        successStatus: 204
      })
    )
    .input(v.object({ params: documentParamsSchema, body: commitImageUploadsSchema })),
  imageLinks: route
    .meta(
      openapi({
        method: 'POST',
        path: '/documents/{documentId}/images/links',
        inputStructure: 'detailed'
      })
    )
    .input(v.object({ params: documentParamsSchema, body: requestImageLinksSchema }))
    .output(v.object({ images: v.array(documentImageLinkSchema) }))
}
