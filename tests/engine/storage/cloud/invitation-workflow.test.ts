import { expect, test } from 'bun:test'

import { createInvitationWorkflow } from '@/app/cloud/documents/invitation-workflow'

test('preview failures expose one typed error and retry the loading phase', async () => {
  let attempts = 0
  const workflow = createInvitationWorkflow({
    serverURL: 'https://cloud.example',
    invitationId: 'invitation',
    token: 'secret',
    callbackURL: 'https://editor.example/invitation',
    navigate: () => undefined,
    open: async () => undefined,
    connect: async () => {
      attempts++
      throw new Error('private diagnostic detail')
    }
  })
  await workflow.load()
  expect(workflow.phase.value).toBe('failed')
  expect(workflow.failure.value).toBe('invitationUnavailable')
  await workflow.retry()
  expect(attempts).toBe(2)
  expect(workflow.invitation.value).toBeNull()
})

test('malformed invitations do not contact a server', async () => {
  let connected = false
  const workflow = createInvitationWorkflow({
    serverURL: '',
    invitationId: '',
    token: '',
    callbackURL: 'https://editor.example',
    navigate: () => undefined,
    open: async () => undefined,
    connect: async () => {
      connected = true
      throw new Error('unexpected')
    }
  })
  await workflow.load()
  expect(connected).toBe(false)
  expect(workflow.failure.value).toBe('invitationUnavailable')
})
