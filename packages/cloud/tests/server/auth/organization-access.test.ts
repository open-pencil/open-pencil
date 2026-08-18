import { describe, expect, test } from 'bun:test'

import { workspaceRoles } from '@open-pencil/cloud/server'

describe('Better Auth workspace access prototype', () => {
  test('models current admin, editor, and viewer permissions', () => {
    expect(
      workspaceRoles.admin.authorize({ workspace: ['delete'], document: ['share'] }).success
    ).toBe(true)
    expect(workspaceRoles.editor.authorize({ document: ['edit', 'share'] }).success).toBe(true)
    expect(workspaceRoles.editor.authorize({ workspace: ['manage-members'] }).success).toBe(false)
    expect(workspaceRoles.viewer.authorize({ document: ['read'] }).success).toBe(true)
    expect(workspaceRoles.viewer.authorize({ document: ['edit'] }).success).toBe(false)
  })
})
