import { documentToolsContract } from '#cloud/contract'
import { documentToolTokenRoutes } from '#cloud/server/api/tokens'
import { documentErrors } from '#cloud/server/documents/procedures'
import { grantReach, type SignedInProcedureContext } from '#cloud/server/tokens'
import { implement } from '@orpc/server'

import type { DocumentToolService } from './service'

/** The routes that run design tools on a document, as the contract describes them. */
export function createDocumentToolProcedures(service: DocumentToolService) {
  const tools = implement(documentToolsContract)
    .$context<SignedInProcedureContext>()
    .use(grantReach(documentToolTokenRoutes))
    .use(documentErrors)
  return tools.router({
    read: tools.read.handler(({ context, input }) =>
      service.run(context.actor, input.params.documentId, 'read', input.body)
    ),
    write: tools.write.handler(({ context, input }) =>
      service.run(context.actor, input.params.documentId, 'write', input.body)
    )
  })
}
