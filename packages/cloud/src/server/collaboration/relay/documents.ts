import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely } from 'kysely'

import type { CollaborationRelayOptions } from './hub'

/** The relay's lookups of a document: its participant limit under `policy`, and its epoch. */
export function relayDocumentLookups(
  database: Kysely<CloudDatabase>,
  policy: CloudPolicy,
  deploymentMode: 'official' | 'self-hosted'
): Pick<CollaborationRelayOptions, 'maximumParticipants' | 'currentRoomEpoch'> {
  return {
    async maximumParticipants(documentId) {
      const document = await database
        .selectFrom('document')
        .select('workspaceId')
        .where('id', '=', documentId)
        .executeTakeFirst()
      if (!document) return 0
      const limit = await policy.number(CLOUD_FEATURE_KEYS.maximumParticipants, -1, {
        targetingKey: document.workspaceId,
        workspaceId: document.workspaceId,
        documentId,
        deploymentMode
      })
      return limit < 0 ? null : limit
    },
    async currentRoomEpoch(documentId) {
      const document = await database
        .selectFrom('document')
        .select('collaborationEpoch')
        .where('id', '=', documentId)
        .executeTakeFirst()
      return document?.collaborationEpoch ?? null
    }
  }
}
