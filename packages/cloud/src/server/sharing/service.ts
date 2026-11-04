import type { CloudUserProfile, LookupCloudUserInput } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { InvitationDelivery, InvitationOutbox } from '#cloud/server/invitations'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely } from 'kysely'

import { requireSharingAccess } from './access'
import {
  createCapabilityService,
  type DocumentShareCapability,
  type ResolvedDocumentShare,
  type ResolvedSharePrincipal
} from './capabilities/service'
import { createGrantService } from './grants/service'
import { createInvitationService, type WorkspaceInvitationResolver } from './invitations/service'

export type { DocumentShareCapability, ResolvedDocumentShare, ResolvedSharePrincipal }

export type DocumentSharingServiceOptions = {
  continuationSecret?: string
  delivery?: InvitationDelivery
  outbox?: InvitationOutbox
  publicURL?: string
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
  workspaceInvitations?: WorkspaceInvitationResolver
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
        .where((expression) =>
          expression(expression.fn('lower', [expression.ref('email')]), '=', input.email)
        )
        .executeTakeFirst()
      return user ?? null
    },

    async userProfile(
      userId: string,
      documentId: string,
      profileUserId: string
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      // Only people connected to this document: its owner, its workspace's members, the holders
      // and givers of its grants, and the people who invited others to it. User IDs are text in
      // these tables, so they are compared with the requested ID rather than `user.id`.
      const related = await database
        .selectFrom('document')
        .select('document.id')
        .where('document.id', '=', documentId)
        .where((expression) =>
          expression.or([
            expression('document.createdBy', '=', profileUserId),
            expression.exists(
              expression
                .selectFrom('workspaceMember')
                .select('workspaceMember.userId')
                .whereRef('workspaceMember.workspaceId', '=', 'document.workspaceId')
                .where('workspaceMember.userId', '=', profileUserId)
            ),
            expression.exists(
              expression
                .selectFrom('documentGrant')
                .select('documentGrant.id')
                .whereRef('documentGrant.documentId', '=', 'document.id')
                .where((grant) =>
                  grant.or([
                    grant.and([
                      grant('documentGrant.userId', '=', profileUserId),
                      grant('documentGrant.revokedAt', 'is', null)
                    ]),
                    grant('documentGrant.createdBy', '=', profileUserId)
                  ])
                )
            ),
            expression.exists(
              expression
                .selectFrom('documentInvitation')
                .select('documentInvitation.id')
                .whereRef('documentInvitation.documentId', '=', 'document.id')
                .where('documentInvitation.invitedBy', '=', profileUserId)
            )
          ])
        )
        .executeTakeFirst()
      if (!related) return null
      const user = await database
        .selectFrom('user')
        .select(['id', 'name', 'email', 'image'])
        .where('id', '=', profileUserId)
        .executeTakeFirst()
      return user ?? null
    },

    ...capabilities,
    ...grants,
    ...invitations
  }
}

export type DocumentSharingService = ReturnType<typeof createDocumentSharingService>
