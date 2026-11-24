import { versionsContract } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import { documentErrors } from '#cloud/server/documents/procedures'
import { implement } from '@orpc/server'

import type { DocumentVersionService } from './service'

/** A document's version history, as the contract describes it, for the signed-in actor. */
export function createDocumentVersionProcedures(service: DocumentVersionService) {
  const versions = implement(versionsContract).$context<{ actor: CloudActor }>().use(documentErrors)
  return versions.router({
    list: versions.list.handler(async ({ context, input }) =>
      service.list(context.actor.userId, input.params.documentId, input.query)
    ),
    save: versions.save.handler(async ({ context, input }) => ({
      version: await service.save(context.actor.userId, input.params.documentId, input.body)
    })),
    update: versions.update.handler(async ({ context, input }) => ({
      version: await service.update(
        context.actor.userId,
        input.params.documentId,
        input.params.versionId,
        input.body
      )
    })),
    download: versions.download.handler(async ({ context, input }) =>
      service.download(context.actor.userId, input.params.documentId, input.params.versionId)
    ),
    restore: versions.restore.handler(async ({ context, input }) =>
      service.restore(context.actor.userId, input.params.documentId, input.params.versionId)
    ),
    duplicate: versions.duplicate.handler(async ({ context, input }) => ({
      document: await service.duplicate(
        context.actor.userId,
        input.params.documentId,
        input.params.versionId,
        input.body
      )
    }))
  })
}
