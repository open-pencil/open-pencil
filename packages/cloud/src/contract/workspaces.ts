import * as v from 'valibot'

export const workspaceRoleSchema = v.picklist(['viewer', 'editor', 'admin'])
export type WorkspaceRole = v.InferOutput<typeof workspaceRoleSchema>

export const workspaceSummarySchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  slug: v.string(),
  role: workspaceRoleSchema,
  createdAt: v.string(),
  updatedAt: v.string()
})
export type WorkspaceSummary = v.InferOutput<typeof workspaceSummarySchema>

export const createWorkspaceSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  slug: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(3),
      v.maxLength(63),
      v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    )
  )
})
export type CreateWorkspaceInput = v.InferOutput<typeof createWorkspaceSchema>

export const workspaceListSchema = v.object({
  workspaces: v.array(workspaceSummarySchema)
})
export type WorkspaceList = v.InferOutput<typeof workspaceListSchema>

export function parseCreateWorkspace(input: unknown): CreateWorkspaceInput {
  return v.parse(createWorkspaceSchema, input)
}
