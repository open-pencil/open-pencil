import { createAccessControl } from 'better-auth/plugins/access'

export const workspaceStatements = {
  workspace: ['read', 'update', 'delete', 'invite', 'manage-members'],
  document: ['create', 'read', 'edit', 'share', 'delete']
} as const

export const workspaceAccessControl = createAccessControl(workspaceStatements)

export const workspaceRoles = {
  admin: workspaceAccessControl.newRole({
    workspace: ['read', 'update', 'delete', 'invite', 'manage-members'],
    document: ['create', 'read', 'edit', 'share', 'delete']
  }),
  editor: workspaceAccessControl.newRole({
    workspace: ['read'],
    document: ['create', 'read', 'edit', 'share']
  }),
  viewer: workspaceAccessControl.newRole({
    workspace: ['read'],
    document: ['read']
  })
}
