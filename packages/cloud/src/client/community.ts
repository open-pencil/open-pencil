import { communityDownloadSchema, type CommunityDownload } from '#cloud/contract'
import type { PublicCloudAPI } from '#cloud/server/api'
import type { hc } from 'hono/client'

import { parseResponse, type CloudClientDiagnostic } from './response'

/** The server’s community gallery, which anyone may open without signing in. */
export function createCommunityRequests(
  publicClient: ReturnType<typeof hc<PublicCloudAPI>>,
  onDiagnostic?: CloudClientDiagnostic
) {
  return {
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
