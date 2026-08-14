import type { DocumentSummary, WorkspaceRole } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

export type DocumentDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function documentSummary(row: {
  id: string
  workspaceId: string
  name: string
  currentRevisionId: string | null
  version: number
  createdAt: Date | string
  updatedAt: Date | string
}): DocumentSummary {
  return {
    ...row,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  }
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

export async function findDocument(
  database: DocumentDatabase,
  userId: string,
  documentId: string
): Promise<(DocumentSummary & { role: WorkspaceRole }) | undefined> {
  const row = await database
    .selectFrom('document')
    .innerJoin('workspaceMember', 'workspaceMember.workspaceId', 'document.workspaceId')
    .select([
      'document.id',
      'document.workspaceId',
      'document.name',
      'document.currentRevisionId',
      'document.version',
      'document.createdAt',
      'document.updatedAt',
      'workspaceMember.role'
    ])
    .where('document.id', '=', documentId)
    .where('document.deletedAt', 'is', null)
    .where('workspaceMember.userId', '=', userId)
    .executeTakeFirst()
  return row ? { ...documentSummary(row), role: row.role } : undefined
}

export async function insertDocument(
  database: DocumentDatabase,
  input: { id: string; workspaceId: string; name: string; createdBy: string }
): Promise<void> {
  await database.insertInto('document').values(input).execute()
}
