import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { getInviterAnonymousLabel } from '../../../packages/api/src/email/template.js'
import { createTestApiApp } from '../../helpers/api.js'

const databases: Array<{ close: () => void }> = []

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close()
  }
})

describe('invitation email', () => {
  test('sends the invitation email through the injected sender', async () => {
    const { app, database, email } = await createTestApiApp()
    databases.push(database)
    const sendSpy = spyOn(email.sender, 'sendInvitation')

    const createBoardResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Inkly-Anonymous-Id': 'anon-owner-abcdef'
      },
      body: JSON.stringify({ name: 'Design review' })
    })
    const board = (await createBoardResponse.json()) as { id: string }

    const inviteResponse = await app.request('http://127.0.0.1:3001/api/invite', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Inkly-Anonymous-Id': 'anon-owner-abcdef'
      },
      body: JSON.stringify({
        email: 'guest@example.com',
        boardId: board.id,
        role: 'editor'
      })
    })

    expect(inviteResponse.status).toBe(201)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(email.sent).toEqual([
      {
        to: 'guest@example.com',
        boardName: 'Design review',
        invitationUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:3001\/invite\//),
        inviterAnonymousId: 'anon-owner-abcdef',
        role: 'editor'
      }
    ])
    expect(getInviterAnonymousLabel('anon-owner-abcdef')).toBe('anon-own')
  })
})
