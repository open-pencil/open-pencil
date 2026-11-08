import { describe, expect, test } from 'bun:test'

import { workspaceRoleCan } from '#cloud/server'

describe('workspace roles', () => {
  test('admins run the workspace and its documents', () => {
    expect(
      workspaceRoleCan('admin', {
        workspace: ['update', 'delete', 'invite', 'manage-members'],
        document: ['create', 'edit', 'share', 'delete']
      })
    ).toBe(true)
  })

  test('editors work on documents, including deleting them, but not on the workspace', () => {
    expect(workspaceRoleCan('editor', { document: ['create', 'edit', 'share', 'delete'] })).toBe(
      true
    )
    expect(workspaceRoleCan('editor', { workspace: ['invite'] })).toBe(false)
    expect(workspaceRoleCan('editor', { workspace: ['manage-members'] })).toBe(false)
  })

  test('viewers only read', () => {
    expect(workspaceRoleCan('viewer', { workspace: ['read'], document: ['read'] })).toBe(true)
    expect(workspaceRoleCan('viewer', { document: ['create'] })).toBe(false)
    expect(workspaceRoleCan('viewer', { document: ['edit'] })).toBe(false)
  })
})
