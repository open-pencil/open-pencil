import type { DocumentAccess, DocumentAccessSource, DocumentPermission } from '#cloud/contract'
import {
  documentRoleCan,
  GRANT_DOCUMENT_ROLE,
  workspaceRoleCan,
  type AccessRequest
} from '#cloud/server/auth/access-control'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

export type AccessDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

type DocumentAccessGrant = {
  source: DocumentAccessSource
  can: (request: AccessRequest) => boolean
}

/**
 * Everything that gives a user access to a document, each checked against its role table: a live
 * document, or one in Trash.
 */
async function documentAccessGrants(
  database: AccessDatabase,
  userId: string,
  documentId: string,
  place: 'live' | 'trash' = 'live'
): Promise<DocumentAccessGrant[]> {
  const document = await database
    .selectFrom('document')
    .leftJoin('workspaceMember', (join) =>
      join
        .onRef('workspaceMember.workspaceId', '=', 'document.workspaceId')
        .on('workspaceMember.userId', '=', userId)
    )
    .leftJoin('documentGrant', (join) =>
      join
        .onRef('documentGrant.documentId', '=', 'document.id')
        .on('documentGrant.userId', '=', userId)
        .on('documentGrant.revokedAt', 'is', null)
    )
    .select([
      'document.createdBy',
      'workspaceMember.role as workspaceRole',
      'documentGrant.permission as grantPermission'
    ])
    .where('document.id', '=', documentId)
    .where('document.deletedAt', place === 'live' ? 'is' : 'is not', null)
    // A document an administrator took down is out of reach for everyone, its owner included.
    .where('document.disabledAt', 'is', null)
    .executeTakeFirst()
  if (!document) return []

  const grants: DocumentAccessGrant[] = []
  // Making a document gives access only while its maker is in the workspace: someone removed
  // from it keeps no way back in.
  if (document.createdBy === userId && document.workspaceRole !== null) {
    grants.push({ source: 'owner', can: (request) => documentRoleCan('owner', request) })
  }
  const { workspaceRole, grantPermission } = document
  if (workspaceRole) {
    grants.push({ source: 'workspace', can: (request) => workspaceRoleCan(workspaceRole, request) })
  }
  if (grantPermission) {
    const role = GRANT_DOCUMENT_ROLE[grantPermission]
    grants.push({ source: 'direct-grant', can: (request) => documentRoleCan(role, request) })
  }
  return grants
}

function grantsAllow(grants: DocumentAccessGrant[], request: AccessRequest): boolean {
  return grants.some((grant) => grant.can(request))
}

export async function resolveDocumentAccess(
  database: AccessDatabase,
  userId: string,
  documentId: string
): Promise<DocumentAccess | undefined> {
  const grants = await documentAccessGrants(database, userId, documentId)
  if (!grantsAllow(grants, { document: ['read'] })) return undefined
  const permission: DocumentPermission = grantsAllow(grants, { document: ['edit'] })
    ? 'edit'
    : 'view'
  return {
    permission,
    canManageSharing: grantsAllow(grants, { document: ['share'] }),
    sources: grants.map((grant) => grant.source)
  }
}

export function canEditDocument(access: DocumentAccess): boolean {
  return access.permission === 'edit'
}

/** Whether the user may delete the document; `documentRoles` and `workspaceRoles` decide who. */
export async function canDeleteDocument(
  database: AccessDatabase,
  userId: string,
  documentId: string
): Promise<boolean> {
  const grants = await documentAccessGrants(database, userId, documentId)
  return grantsAllow(grants, { document: ['delete'] })
}

/** Whether the user may restore the document from Trash, or delete it there for good. */
export async function trashedDocumentAllows(
  database: AccessDatabase,
  userId: string,
  documentId: string,
  action: 'delete' | 'purge'
): Promise<boolean> {
  const grants = await documentAccessGrants(database, userId, documentId, 'trash')
  return grantsAllow(grants, { document: [action] })
}
