import { describe, expect, test } from 'bun:test'

import { renderTransactionalEmail } from '#cloud/email'

describe('workspace invitation email', () => {
  test('names the workspace, the inviter, and what joining lets the person do', async () => {
    const acceptanceURL = 'https://cloud.example.com/invitations/id#secret'
    const rendered = await renderTransactionalEmail({
      kind: 'workspace-invitation',
      payload: {
        inviterName: 'Ana',
        workspaceName: 'Studio',
        role: 'editor',
        expiresAt: '2026-10-22T00:00:00.000Z',
        acceptanceURL
      }
    })
    expect(rendered.subject).toBe('Ana invited you to Studio')
    expect(rendered.text).toContain('Ana invited you to edit in the workspace “Studio”')
    expect(rendered.html).toContain(acceptanceURL)
    expect(rendered.text).toContain('Join workspace')
  })
})
