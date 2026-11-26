import { oc } from '@orpc/contract'
import * as v from 'valibot'

import {
  communityDocumentsSchema,
  communityDownloadQuerySchema,
  communityDownloadSchema
} from '../community'
import { documentImageLinkSchema, requestImageLinksSchema } from '../documents'
import { DOCUMENT_ERRORS } from './errors'
import { documentParamsSchema } from './params'
import { at } from './route'

const route = oc.errors(DOCUMENT_ERRORS)

/**
 * The community gallery for anyone, signed in or not: the list, a document or one of its named
 * versions to open read-only, and the links of its images. A deployment without a gallery
 * answers not found.
 */
export const communityContract = {
  list: route.meta(at('GET', '/community', { outputStructure: 'detailed' })).output(
    v.object({
      /** The gallery changes on a publish; a few minutes' copy spares the database repeat visits. */
      headers: v.object({ 'cache-control': v.string() }),
      body: communityDocumentsSchema
    })
  ),
  document: route
    .meta(at('GET', '/community/{documentId}/document'))
    .input(v.object({ params: documentParamsSchema, query: communityDownloadQuerySchema }))
    .output(communityDownloadSchema),
  imageLinks: route
    .meta(at('POST', '/community/{documentId}/images'))
    .input(v.object({ params: documentParamsSchema, body: requestImageLinksSchema }))
    .output(v.object({ images: v.array(documentImageLinkSchema) }))
}
