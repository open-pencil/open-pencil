import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { workspacePolicyContext } from '#cloud/server/policy/workspace'
import type { Kysely } from 'kysely'

import type { CollaborationRelayOptions } from './hub'

/**
 * The relay's lookups of a document: its participant limit under `policy`, none while it is taken
 * down, and its epoch.
 */
export function relayDocumentLookups(
  database: Kysely<CloudDatabase>,
  policy: CloudPolicy,
  deploymentMode: 'official' | 'self-hosted'
): Pick<CollaborationRelayOptions, 'maximumParticipants' | 'currentRoomEpoch'> {
  return {
    async maximumParticipants(documentId) {
      // A taken-down document's room takes nobody, even with a ticket issued before.
      const open = await database
        .selectFrom('document')
        .select('id')
        .where('id', '=', documentId)
        .where('disabledAt', 'is', null)
        .executeTakeFirst()
      if (!open) return 0
      const context = await workspacePolicyContext(database, { documentId }, { deploymentMode })
      if (!context) return 0
      const limit = await policy.number(CLOUD_FEATURE_KEYS.maximumParticipants, -1, context)
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
