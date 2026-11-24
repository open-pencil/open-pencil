import {
  documentImageLinkSchema,
  type CommitImageUploadsInput,
  type DocumentImageLink,
  type ImageUploadOffer,
  type RequestImageUploadsInput,
  type ResolveDocumentShareInput
} from '#cloud/contract'
import type { PublicCloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'
import * as v from 'valibot'

import type { CloudContractClient } from './contract'
import { parseResponse, type CloudClientDiagnostic } from './response'

const imageLinksResponseSchema = v.object({ images: v.array(documentImageLinkSchema) })

/** The images a save uploads apart from the document, and the links a live room loads them by. */
export function createImageRequests(
  publicClient: ReturnType<typeof hc<PublicCloudAPI>>,
  contract: CloudContractClient['documents'],
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    /** Uploads for the images a save will name that the document's workspace lacks. */
    async requestImageUploads(
      documentId: string,
      input: RequestImageUploadsInput
    ): Promise<ImageUploadOffer[]> {
      return (await contract.requestImageUploads({ params: { documentId }, body: input })).uploads
    },
    /** Commits the image uploads a save asked for, once their bytes are in place. */
    async commitImageUploads(
      documentId: string,
      uploads: CommitImageUploadsInput['uploads']
    ): Promise<void> {
      await contract.commitImageUploads({ params: { documentId }, body: { uploads } })
    },
    /** Links for images a document's live room names. */
    async getImageLinks(documentId: string, checksums: string[]): Promise<DocumentImageLink[]> {
      return (await contract.imageLinks({ params: { documentId }, body: { checksums } })).images
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
