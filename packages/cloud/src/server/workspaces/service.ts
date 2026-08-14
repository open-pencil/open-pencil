import type { CreateWorkspaceInput, WorkspaceSummary } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import {
  findWorkspace,
  insertWorkspace,
  insertWorkspaceMember,
  listWorkspaces
} from '#cloud/server/workspaces/repository'
import type { Kysely } from 'kysely'

export class WorkspaceSlugConflictError extends Error {
  constructor(readonly slug: string) {
    super(`Workspace slug is already in use: ${slug}`)
    this.name = 'WorkspaceSlugConflictError'
  }
}

function fallbackSlug(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return normalized.length >= 3 ? normalized : 'workspace'
}

function generatedSlug(name: string): string {
  return `${fallbackSlug(name)}-${crypto.randomUUID().slice(0, 8)}`
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

export function createWorkspaceService(database: Kysely<CloudDatabase>) {
  return {
    list(userId: string): Promise<WorkspaceSummary[]> {
      return listWorkspaces(database, userId)
    },

    get(userId: string, workspaceId: string): Promise<WorkspaceSummary | undefined> {
      return findWorkspace(database, userId, workspaceId)
    },

    async create(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceSummary> {
      const workspaceId = crypto.randomUUID()
      const slug = input.slug ?? generatedSlug(input.name)
      try {
        await database.transaction().execute(async (transaction) => {
          await insertWorkspace(transaction, userId, { ...input, id: workspaceId, slug })
          await insertWorkspaceMember(transaction, workspaceId, userId, 'admin')
        })
      } catch (error) {
        if (isUniqueViolation(error)) throw new WorkspaceSlugConflictError(slug)
        throw error
      }
      const workspace = await findWorkspace(database, userId, workspaceId)
      if (!workspace) throw new Error('Created workspace could not be read')
      return workspace
    }
  }
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>
