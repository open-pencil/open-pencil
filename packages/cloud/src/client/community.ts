import {
  communityDocumentsSchema,
  communityDownloadSchema,
  type CommunityDocument,
  type CommunityDownload
} from '#cloud/contract'
import type { PublicCloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'

import { parseResponse, type CloudClientDiagnostic } from './response'

/** The server’s community gallery, which anyone may open without signing in. */
export function createCommunityRequests(
  publicClient: ReturnType<typeof hc<PublicCloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
    /** The gallery's documents, most recently changed first, each with its named versions. */
    async listCommunityDocuments(): Promise<CommunityDocument[]> {
      const response = await parseResponse(
        publicClient.community.$get(),
        communityDocumentsSchema,
        onDiagnostic
      )
      return response.documents
    },

    /**
     * A document of the server's community gallery as it is now, or one of its named versions,
     * which anyone may open without signing in.
     */
    async getCommunityDocument(
      documentId: string,
      versionId: string | null = null
    ): Promise<CommunityDownload> {
      return parseResponse(
        publicClient.community[':documentId'].document.$get({
          param: { documentId },
          query: versionId ? { version: versionId } : {}
        }),
        communityDownloadSchema,
        onDiagnostic
      )
    }
  }
}
