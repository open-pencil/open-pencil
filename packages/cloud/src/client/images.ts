import type {
  CommitImageUploadsInput,
  DocumentImageLink,
  ImageUploadOffer,
  RequestImageUploadsInput,
  ResolveDocumentShareInput
} from '#cloud/contract'

import type { CloudContractClient } from './contract'

/** The images a save uploads apart from the document, and the links a live room loads them by. */
export function createImageRequests(
  contract: CloudContractClient['documents'],
  publicSharing: CloudContractClient['publicSharing']
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
      return (
        await publicSharing.imageLinks({ params: { shareId }, body: { ...input, checksums } })
      ).images
    }
  }
}
