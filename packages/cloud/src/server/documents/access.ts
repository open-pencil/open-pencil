import type {
  DocumentAccess,
  DocumentAccessSource,
  DocumentPermission,
  WorkspaceRole
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { maxBy } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'

export type AccessDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

const PERMISSION_WEIGHT: Record<DocumentPermission, number> = { view: 1, edit: 2 }

function workspacePermission(role: WorkspaceRole): DocumentPermission {
  return role === 'viewer' ? 'view' : 'edit'
}

export async function resolveDocumentAccess(
  database: AccessDatabase,
  userId: string,
  documentId: string
): Promise<DocumentAccess | undefined> {
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
    .where('document.deletedAt', 'is', null)
    .executeTakeFirst()
  if (!document) return undefined

  const sources: DocumentAccessSource[] = []
  const candidates: DocumentPermission[] = []
  const owner = document.createdBy === userId
  if (owner) {
    sources.push('owner')
    candidates.push('edit')
  }
  if (document.workspaceRole) {
    sources.push('workspace')
    candidates.push(workspacePermission(document.workspaceRole))
  }
  if (document.grantPermission) {
    sources.push('direct-grant')
    candidates.push(document.grantPermission)
  }
  const permission = maxBy(candidates, (candidate) => PERMISSION_WEIGHT[candidate])
  if (!permission) return undefined
  const workspaceCanManage =
    document.workspaceRole === 'admin' || document.workspaceRole === 'editor'
  return {
    permission,
    canManageSharing: owner || workspaceCanManage || document.grantPermission === 'edit',
    sources
  }
}

export function canEditDocument(access: DocumentAccess): boolean {
  return access.permission === 'edit'
}

/**
 * Removing a document belongs to its owner and its workspace's admins and editors. A direct grant
 * or an accepted invitation lets someone edit, never delete the owner's document.
 */
export async function canDeleteDocument(
  database: AccessDatabase,
  userId: string,
  documentId: string
): Promise<boolean> {
  const document = await database
    .selectFrom('document')
    .leftJoin('workspaceMember', (join) =>
      join
        .onRef('workspaceMember.workspaceId', '=', 'document.workspaceId')
        .on('workspaceMember.userId', '=', userId)
    )
    .select(['document.createdBy', 'workspaceMember.role as workspaceRole'])
    .where('document.id', '=', documentId)
    .where('document.deletedAt', 'is', null)
    .executeTakeFirst()
  if (!document) return false
  return (
    document.createdBy === userId ||
    document.workspaceRole === 'admin' ||
    document.workspaceRole === 'editor'
  )
}
