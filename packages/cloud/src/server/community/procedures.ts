import { communityContract } from '#cloud/contract'
import { documentErrors } from '#cloud/server/documents/procedures'
import { implement } from '@orpc/server'

import type { CommunityService } from './service'

/** The community gallery, as the contract describes it, for anyone. */
export function createCommunityProcedures(community: CommunityService) {
  const routes = implement(communityContract).use(documentErrors)
  return routes.router({
    list: routes.list.handler(async ({ errors }) => {
      if (!community.enabled) throw errors.not_found()
      return {
        headers: { 'cache-control': 'public, max-age=300' },
        body: { documents: await community.list() }
      }
    }),
    document: routes.document.handler(({ input }) =>
      community.download(input.params.documentId, input.query.version)
    ),
    imageLinks: routes.imageLinks.handler(({ input }) =>
      community.imageLinks(input.params.documentId, input.body.checksums)
    )
  })
}
