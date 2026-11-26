import type { CreateWorkspaceInput, WorkspaceRole, WorkspaceSummary } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

export type WorkspaceDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

function toISOString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function summary(
  {
    ownerId,
    ...row
  }: Omit<WorkspaceSummary, 'owner' | 'createdAt' | 'updatedAt'> & {
    ownerId: string
    createdAt: Date | string
    updatedAt: Date | string
  },
  userId: string
): WorkspaceSummary {
  return {
    ...row,
    owner: ownerId === userId,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt)
  }
}

export async function listWorkspaces(
  database: WorkspaceDatabase,
  userId: string
): Promise<WorkspaceSummary[]> {
  const rows = await database
    .selectFrom('workspace')
    .innerJoin('workspaceMember', 'workspaceMember.workspaceId', 'workspace.id')
    .select([
      'workspace.id',
      'workspace.name',
      'workspace.slug',
      'workspace.createdAt',
      'workspace.updatedAt',
      'workspace.ownerId',
      'workspaceMember.role'
    ])
    .where('workspaceMember.userId', '=', userId)
    .orderBy('workspace.updatedAt', 'desc')
    .execute()

  return rows.map((row) => summary(row, userId))
}

export async function findWorkspace(
  database: WorkspaceDatabase,
  userId: string,
  workspaceId: string
): Promise<WorkspaceSummary | undefined> {
  const row = await database
    .selectFrom('workspace')
    .innerJoin('workspaceMember', 'workspaceMember.workspaceId', 'workspace.id')
    .select([
      'workspace.id',
      'workspace.name',
      'workspace.slug',
      'workspace.createdAt',
      'workspace.updatedAt',
      'workspace.ownerId',
      'workspaceMember.role'
    ])
    .where('workspace.id', '=', workspaceId)
    .where('workspaceMember.userId', '=', userId)
    .executeTakeFirst()
  return row ? summary(row, userId) : undefined
}

export async function insertWorkspace(
  database: WorkspaceDatabase,
  actorId: string,
  input: CreateWorkspaceInput & { id: string; slug: string }
): Promise<boolean> {
  const inserted = await database
    .insertInto('workspace')
    .values({
      id: input.id,
      name: input.name,
      slug: input.slug,
      createdBy: actorId,
      ownerId: actorId
    })
    .onConflict((conflict) => conflict.column('slug').doNothing())
    .returning('id')
    .executeTakeFirst()
  return inserted !== undefined
}

export async function insertWorkspaceMember(
  database: WorkspaceDatabase,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): Promise<void> {
  await database.insertInto('workspaceMember').values({ workspaceId, userId, role }).execute()
}
