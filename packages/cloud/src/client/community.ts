import type { CommunityDocuments, CommunityDownload } from '#cloud/contract'

import type { CloudContractClient } from './contract'

/** The server’s community gallery, which anyone may open without signing in. */
export function createCommunityRequests(contract: CloudContractClient['community']) {
  return {
    /** The gallery's documents, most recently changed first. */
    async listCommunityDocuments(): Promise<CommunityDocuments> {
      return (await contract.list()).body
    },
    /**
     * A document of the server's community gallery as it is now, or one of its named versions,
     * which anyone may open without signing in.
     */
    getCommunityDocument(
      documentId: string,
      versionId: string | null = null
    ): Promise<CommunityDownload> {
      return contract.document({
        params: { documentId },
        query: versionId ? { version: versionId } : {}
      })
    }
  }
}
