import type { DocumentPermission, WorkspaceRole } from '#cloud/contract'
import { createAccessControl } from 'better-auth/plugins/access'

export const accessStatements = {
  workspace: ['read', 'update', 'delete', 'invite', 'manage-members'],
  document: ['create', 'read', 'edit', 'share', 'delete']
} as const

type AccessStatements = typeof accessStatements

/** Actions a check asks for, by resource; every listed action must be allowed. */
export type AccessRequest = {
  [Resource in keyof AccessStatements]?: AccessStatements[Resource][number][]
}

export const accessControl = createAccessControl(accessStatements)

/**
 * What a workspace member may do there, by role. Together with `documentRoles` this is the whole
 * permission policy: every check goes through `workspaceRoleCan` or `documentRoleCan`.
 */
export const workspaceRoles = {
  admin: accessControl.newRole({
    workspace: ['read', 'update', 'delete', 'invite', 'manage-members'],
    document: ['create', 'read', 'edit', 'share', 'delete']
  }),
  editor: accessControl.newRole({
    workspace: ['read'],
    document: ['create', 'read', 'edit', 'share', 'delete']
  }),
  viewer: accessControl.newRole({
    workspace: ['read'],
    document: ['read']
  })
} satisfies Record<WorkspaceRole, unknown>

/**
 * What someone may do with one document through something other than workspace membership: being
 * its owner, or a grant made to them. A grant lets its holder edit and share, never delete the
 * owner's document.
 */
export const documentRoles = {
  owner: accessControl.newRole({ document: ['read', 'edit', 'share', 'delete'] }),
  editor: accessControl.newRole({ document: ['read', 'edit', 'share'] }),
  viewer: accessControl.newRole({ document: ['read'] })
}

export type DocumentRole = keyof typeof documentRoles

/** The document role a direct grant of this permission gives. */
export const GRANT_DOCUMENT_ROLE: Record<DocumentPermission, DocumentRole> = {
  view: 'viewer',
  edit: 'editor'
}

export function workspaceRoleCan(role: WorkspaceRole, request: AccessRequest): boolean {
  return workspaceRoles[role].authorize(request).success
}

export function documentRoleCan(role: DocumentRole, request: AccessRequest): boolean {
  return documentRoles[role].authorize(request).success
}
