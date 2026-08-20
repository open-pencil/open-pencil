import type { CloudUserProfile, LookupCloudUserInput } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { InvitationDelivery } from '#cloud/server/invitations'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'

import { requireSharingAccess } from './access'
import {
  createCapabilityService,
  type DocumentShareCapability,
  type ResolvedDocumentShare,
  type ResolvedSharePrincipal
} from './capabilities/service'
import { createGrantService } from './grants/service'
import { createInvitationService } from './invitations/service'

export type { DocumentShareCapability, ResolvedDocumentShare, ResolvedSharePrincipal }

export type DocumentSharingServiceOptions = {
  continuationSecret?: string
  delivery?: InvitationDelivery
  publicURL?: string
  appURL?: string
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
}

export function createDocumentSharingService(
  database: Kysely<CloudDatabase>,
  options: DocumentSharingServiceOptions = {}
) {
  const capabilities = createCapabilityService(database, options)
  const grants = createGrantService(database)
  const invitations = createInvitationService(database, options)

  return {
    async lookupUser(
      userId: string,
      documentId: string,
      input: LookupCloudUserInput
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      const user = await database
        .selectFrom('user')
        .select(['id', 'name', 'email', 'image'])
        .where(sql<string>`lower(email)`, '=', input.email)
        .executeTakeFirst()
      return user ?? null
    },

    async userProfile(
      userId: string,
      documentId: string,
      profileUserId: string
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      return (
        (await database
          .selectFrom('user')
          .select(['id', 'name', 'email', 'image'])
          .where('id', '=', profileUserId)
          .executeTakeFirst()) ?? null
      )
    },

    ...capabilities,
    ...grants,
    ...invitations
  }
}

export type DocumentSharingService = ReturnType<typeof createDocumentSharingService>
