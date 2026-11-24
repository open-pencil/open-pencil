import { oc } from '@orpc/contract'
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
import { DOCUMENT_ERRORS } from './errors'
import { documentParamsSchema, uploadParamsSchema, workspaceParamsSchema } from './params'
import { at } from './route'

const route = oc.errors(DOCUMENT_ERRORS)

const documentResultSchema = v.object({ document: documentSummarySchema })

/** Documents: listing and creating them, Trash, downloads, uploads, and their images. */
export const documentsContract = {
  listShared: route
    .meta(openapi({ method: 'GET', path: '/shared-documents' }))
    .output(v.object({ documents: v.array(sharedDocumentSchema) })),
  listTrash: route.meta(openapi({ method: 'GET', path: '/trash' })).output(trashSchema),
  restore: route
    .meta(at('POST', '/trash/{documentId}/restore', { successStatus: 204 }))
    .input(v.object({ params: documentParamsSchema })),
  purge: route
    .meta(at('DELETE', '/trash/{documentId}', { successStatus: 204 }))
    .input(v.object({ params: documentParamsSchema })),
  list: route
    .meta(at('GET', '/workspaces/{workspaceId}/documents'))
    .input(v.object({ params: workspaceParamsSchema }))
    .output(v.object({ documents: v.array(documentSummarySchema) })),
  usage: route
    .meta(at('GET', '/workspaces/{workspaceId}/usage'))
    .input(v.object({ params: workspaceParamsSchema }))
    .output(v.object({ usage: workspaceUsageSchema })),
  create: route
    .meta(at('POST', '/workspaces/{workspaceId}/documents', { successStatus: 201 }))
    .input(v.object({ params: workspaceParamsSchema, body: createDocumentSchema }))
    .output(documentResultSchema),
  remove: route
    .meta(at('DELETE', '/documents/{documentId}', { successStatus: 204 }))
    .input(v.object({ params: documentParamsSchema })),
  access: route
    .meta(at('GET', '/documents/{documentId}/access'))
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ access: documentAccessSchema })),
  summary: route
    .meta(at('GET', '/documents/{documentId}/summary'))
    .input(v.object({ params: documentParamsSchema }))
    .output(documentResultSchema),
  download: route
    .meta(at('GET', '/documents/{documentId}'))
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ document: documentDownloadSchema })),
  createUpload: route
    .meta(at('POST', '/documents/{documentId}/uploads', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: createUploadSchema }))
    .output(v.object({ id: v.pipe(v.string(), v.uuid()), upload: objectUploadSchema })),
  commitUpload: route
    .meta(at('POST', '/uploads/{uploadId}/commit'))
    .input(v.object({ params: uploadParamsSchema, body: commitUploadSchema }))
    .output(documentResultSchema),
  requestImageUploads: route
    .meta(at('POST', '/documents/{documentId}/images', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: requestImageUploadsSchema }))
    .output(v.object({ uploads: v.array(imageUploadOfferSchema) })),
  commitImageUploads: route
    .meta(at('POST', '/documents/{documentId}/images/commit', { successStatus: 204 }))
    .input(v.object({ params: documentParamsSchema, body: commitImageUploadsSchema })),
  imageLinks: route
    .meta(at('POST', '/documents/{documentId}/images/links'))
    .input(v.object({ params: documentParamsSchema, body: requestImageLinksSchema }))
    .output(v.object({ images: v.array(documentImageLinkSchema) }))
}
