import type { WorkspaceRole } from '#cloud/contract'
import { createAccessControl } from 'better-auth/plugins/access'

export const workspaceStatements = {
  workspace: ['read', 'update', 'delete', 'invite', 'manage-members'],
  document: ['create', 'read', 'edit', 'share', 'delete']
} as const

type WorkspaceStatements = typeof workspaceStatements

/** Actions a check asks for, by resource; every listed action must be allowed. */
export type WorkspaceAccessRequest = {
  [Resource in keyof WorkspaceStatements]?: WorkspaceStatements[Resource][number][]
}

export const workspaceAccessControl = createAccessControl(workspaceStatements)

/**
 * What each workspace role may do. Every workspace permission check goes through
 * `workspaceRoleCan`, so this table is the whole policy.
 */
export const workspaceRoles = {
  admin: workspaceAccessControl.newRole({
    workspace: ['read', 'update', 'delete', 'invite', 'manage-members'],
    document: ['create', 'read', 'edit', 'share', 'delete']
  }),
  editor: workspaceAccessControl.newRole({
    workspace: ['read'],
    document: ['create', 'read', 'edit', 'share', 'delete']
  }),
  viewer: workspaceAccessControl.newRole({
    workspace: ['read'],
    document: ['read']
  })
} satisfies Record<WorkspaceRole, unknown>

export function workspaceRoleCan(role: WorkspaceRole, request: WorkspaceAccessRequest): boolean {
  return workspaceRoles[role].authorize(request).success
}
