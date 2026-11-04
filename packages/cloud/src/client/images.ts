import {
  documentImageLinkSchema,
  imageUploadOfferSchema,
  type CommitImageUploadsInput,
  type DocumentImageLink,
  type ImageUploadOffer,
  type RequestImageUploadsInput,
  type ResolveDocumentShareInput
} from '#cloud/contract'
import type { CloudAPI, PublicCloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'
import * as v from 'valibot'

import { parseResponse, responseBody, type CloudClientDiagnostic } from './response'

const imageLinksResponseSchema = v.object({ images: v.array(documentImageLinkSchema) })
const imageUploadsResponseSchema = v.object({ uploads: v.array(imageUploadOfferSchema) })

/** The images a save uploads apart from the document, and the links a live room loads them by. */
export function createImageRequests(
  client: ReturnType<typeof hc<CloudAPI>>,
  publicClient: ReturnType<typeof hc<PublicCloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    /** Uploads for the images a save will name that the document's workspace lacks. */
    async requestImageUploads(
      documentId: string,
      input: RequestImageUploadsInput
    ): Promise<ImageUploadOffer[]> {
      const response = await parseResponse(
        client.documents[':documentId'].images.$post({
          param: { documentId },
          json: input
        }),
        imageUploadsResponseSchema,
        onDiagnostic
      )
      return response.uploads
    },
    /** Commits the image uploads a save asked for, once their bytes are in place. */
    async commitImageUploads(
      documentId: string,
      uploads: CommitImageUploadsInput['uploads']
    ): Promise<void> {
      const response = await client.documents[':documentId'].images.commit.$post({
        param: { documentId },
        json: { uploads }
      })
      await responseBody(response, onDiagnostic)
    },
    /** Links for images a document's live room names. */
    async getImageLinks(documentId: string, checksums: string[]): Promise<DocumentImageLink[]> {
      const response = await parseResponse(
        client.documents[':documentId'].images.links.$post({
          param: { documentId },
          json: { checksums }
        }),
        imageLinksResponseSchema,
        onDiagnostic
      )
      return response.images
    },
    /** Links for images a shared document's live room names, as the share's guest. */
    async getSharedImageLinks(
      shareId: string,
      input: ResolveDocumentShareInput,
      checksums: string[]
    ): Promise<DocumentImageLink[]> {
      const response = await parseResponse(
        publicClient.shares[':shareId'].images.$post({
          param: { shareId },
          json: { ...input, checksums }
        }),
        imageLinksResponseSchema,
        onDiagnostic
      )
      return response.images
    }
  }
}
