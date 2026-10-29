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

export const updateWorkspaceSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))
})
export type UpdateWorkspaceInput = v.InferOutput<typeof updateWorkspaceSchema>

/** Someone who belongs to a workspace, and what they may do in it. */
export const workspaceMemberSchema = v.object({
  userId: v.string(),
  name: v.string(),
  email: v.string(),
  image: v.nullable(v.string()),
  role: workspaceRoleSchema,
  joinedAt: v.string()
})
export type WorkspaceMember = v.InferOutput<typeof workspaceMemberSchema>

/** An invitation to join a workspace that has not been accepted yet. */
export const workspaceInvitationSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  email: v.string(),
  role: workspaceRoleSchema,
  /** Who sent it; the name is null once their account is gone. */
  invitedBy: v.object({ id: v.string(), name: v.nullable(v.string()) }),
  invitedAt: v.string(),
  expiresAt: v.string()
})
export type WorkspaceInvitation = v.InferOutput<typeof workspaceInvitationSchema>

export const workspaceMembersSchema = v.object({
  members: v.array(workspaceMemberSchema),
  /** Only administrators see pending invitations. */
  invitations: v.array(workspaceInvitationSchema)
})
export type WorkspaceMembers = v.InferOutput<typeof workspaceMembersSchema>

export const createWorkspaceInvitationSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  role: workspaceRoleSchema
})
export type CreateWorkspaceInvitationInput = v.InferOutput<typeof createWorkspaceInvitationSchema>

/** A new invitation and its link, for an administrator to pass on when email is off. */
export const createdWorkspaceInvitationSchema = v.object({
  invitation: workspaceInvitationSchema,
  acceptanceURL: v.string()
})
export type CreatedWorkspaceInvitation = v.InferOutput<typeof createdWorkspaceInvitationSchema>

export const updateWorkspaceMemberSchema = v.object({ role: workspaceRoleSchema })
export type UpdateWorkspaceMemberInput = v.InferOutput<typeof updateWorkspaceMemberSchema>

export function parseCreateWorkspace(input: unknown): CreateWorkspaceInput {
  return v.parse(createWorkspaceSchema, input)
}

export function parseUpdateWorkspace(input: unknown): UpdateWorkspaceInput {
  return v.parse(updateWorkspaceSchema, input)
}

export function parseCreateWorkspaceInvitation(input: unknown): CreateWorkspaceInvitationInput {
  return v.parse(createWorkspaceInvitationSchema, input)
}

export function parseUpdateWorkspaceMember(input: unknown): UpdateWorkspaceMemberInput {
  return v.parse(updateWorkspaceMemberSchema, input)
}
