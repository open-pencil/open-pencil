import type { DocumentSummary, SharedDocument, WorkspaceRole } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { CreateDocumentRecord } from '#cloud/server/documents/types'
import { uniq } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'
import * as v from 'valibot'

import { resolveDocumentAccess } from './access'
import { documentSummary, getDocumentSummaryRow } from './summary'

const UUID = v.pipe(v.string(), v.uuid())

export type DocumentDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

export type DocumentSummaryRow = Omit<DocumentSummary, 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string
  updatedAt: Date | string
}

export async function workspaceRole(
  database: DocumentDatabase,
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | undefined> {
  const member = await database
    .selectFrom('workspaceMember')
    .select('role')
    .where('workspaceId', '=', workspaceId)
    .where('userId', '=', userId)
    .executeTakeFirst()
  return member?.role
}

export async function listDocuments(
  database: DocumentDatabase,
  userId: string,
  workspaceId: string
): Promise<DocumentSummary[] | undefined> {
  if (!(await workspaceRole(database, userId, workspaceId))) return undefined
  const rows = await database
    .selectFrom('document')
    .select(['id', 'workspaceId', 'name', 'currentRevisionId', 'version', 'createdAt', 'updatedAt'])
    .where('workspaceId', '=', workspaceId)
    .where('deletedAt', 'is', null)
    .orderBy('updatedAt', 'desc')
    .execute()
  return rows.map(documentSummary)
}

/** Documents granted to the person directly that live in workspaces they are not a member of. */
export async function listSharedDocuments(
  database: DocumentDatabase,
  userId: string
): Promise<SharedDocument[]> {
  const rows = await database
    .selectFrom('documentGrant')
    .innerJoin('document', 'document.id', 'documentGrant.documentId')
    .innerJoin('workspace', 'workspace.id', 'document.workspaceId')
    .select([
      'document.id',
      'document.workspaceId',
      'document.name',
      'document.currentRevisionId',
      'document.version',
      'document.createdAt',
      'document.updatedAt',
      'workspace.name as workspaceName',
      'documentGrant.permission',
      'documentGrant.createdAt as sharedAt',
      'documentGrant.createdBy'
    ])
    .where('documentGrant.userId', '=', userId)
    .where('documentGrant.revokedAt', 'is', null)
    .where('document.deletedAt', 'is', null)
    .where((expression) =>
      expression.not(
        expression.exists(
          expression
            .selectFrom('workspaceMember')
            .select('workspaceMember.userId')
            .whereRef('workspaceMember.workspaceId', '=', 'document.workspaceId')
            .where('workspaceMember.userId', '=', userId)
        )
      )
    )
    .orderBy('document.updatedAt', 'desc')
    .execute()
  // Grants can be made by operator tools whose IDs are not accounts, so only UUIDs are looked up.
  const granters = uniq(rows.map((row) => row.createdBy)).filter((id) => v.is(UUID, id))
  const names = new Map(
    granters.length === 0
      ? []
      : (
          await database
            .selectFrom('user')
            .select(['id', 'name'])
            .where('id', 'in', granters)
            .execute()
        ).map((user) => [user.id, user.name] as const)
  )
  return rows.map(({ workspaceName, permission, sharedAt, createdBy, ...row }) => {
    const sharedByName = names.get(createdBy)
    return {
      ...documentSummary(row),
      workspaceName,
      permission,
      sharedBy: sharedByName === undefined ? null : { name: sharedByName },
      sharedAt: sharedAt instanceof Date ? sharedAt.toISOString() : sharedAt
    }
  })
}

export async function findDocument(
  database: DocumentDatabase,
  userId: string,
  documentId: string
): Promise<(DocumentSummary & { role: WorkspaceRole }) | undefined> {
  const access = await resolveDocumentAccess(database, userId, documentId)
  if (!access) return undefined
  const row = await getDocumentSummaryRow(database, documentId)
  if (!row) return undefined
  const role: WorkspaceRole = access.permission === 'edit' ? 'editor' : 'viewer'
  return { ...documentSummary(row), role }
}

export async function insertDocument(
  database: DocumentDatabase,
  input: CreateDocumentRecord
): Promise<void> {
  await database.insertInto('document').values(input).execute()
}
