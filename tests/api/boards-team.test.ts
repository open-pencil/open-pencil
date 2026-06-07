import { describe, expect, test } from 'bun:test'

import { TEST_API_SECRET, createTestApiApp } from '../helpers/api.js'
import { TEST_USER_HEADER, createHeaderAuth, createSession, seedUsers } from '../helpers/api-auth.js'

describe('board team ownership routes', () => {
  test('attaches and detaches boards from teams and exposes team boards to members', async () => {
    const owner = createSession('user-owner', 'Owner User', 'owner@example.com')
    const editor = createSession('user-editor', 'Editor User', 'editor@example.com')
    const outsider = createSession('user-outsider', 'Outsider User', 'outsider@example.com')
    const { app, database } = await createTestApiApp({
      auth: createHeaderAuth([owner, editor, outsider]),
      secret: TEST_API_SECRET
    })
    await seedUsers(database, [owner, editor, outsider])

    const createTeamResponse = await app.request('/api/teams', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ name: 'Workspace Alpha' })
    })
    const team = (await createTeamResponse.json()) as { id: string; name: string }

    const addEditorResponse = await app.request(`/api/teams/${team.id}/members`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({
        userId: editor.user.id,
        role: 'editor'
      })
    })
    expect(addEditorResponse.status).toBe(201)

    const createPersonalBoardResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ name: 'Roadmap Board' })
    })
    expect(createPersonalBoardResponse.status).toBe(201)
    const personalBoard = (await createPersonalBoardResponse.json()) as {
      id: string
      teamId: string | null
      team: { id: string; name: string } | null
    }
    expect(personalBoard.teamId).toBeNull()
    expect(personalBoard.team).toBeNull()

    const createTeamBoardAsEditorResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: editor.user.id
      },
      body: JSON.stringify({
        name: 'Editor Board',
        teamId: team.id
      })
    })
    expect(createTeamBoardAsEditorResponse.status).toBe(403)

    const attachBoardResponse = await app.request(`/api/boards/${personalBoard.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ teamId: team.id })
    })
    expect(attachBoardResponse.status).toBe(200)
    expect(await attachBoardResponse.json()).toEqual(
      expect.objectContaining({
        id: personalBoard.id,
        teamId: team.id,
        team: {
          id: team.id,
          name: team.name
        }
      })
    )

    const ownerBoardsResponse = await app.request('/api/boards', {
      headers: { [TEST_USER_HEADER]: owner.user.id }
    })
    expect(ownerBoardsResponse.status).toBe(200)
    expect(await ownerBoardsResponse.json()).toEqual({
      boards: [expect.objectContaining({ id: personalBoard.id, teamId: team.id })]
    })

    const memberBoardsResponse = await app.request('/api/boards', {
      headers: { [TEST_USER_HEADER]: editor.user.id }
    })
    expect(memberBoardsResponse.status).toBe(200)
    expect(await memberBoardsResponse.json()).toEqual({
      boards: [
        expect.objectContaining({
          id: personalBoard.id,
          teamId: team.id,
          team: {
            id: team.id,
            name: team.name
          }
        })
      ]
    })

    const outsiderBoardsResponse = await app.request('/api/boards', {
      headers: { [TEST_USER_HEADER]: outsider.user.id }
    })
    expect(outsiderBoardsResponse.status).toBe(200)
    expect(await outsiderBoardsResponse.json()).toEqual({ boards: [] })

    const detachBoardResponse = await app.request(`/api/boards/${personalBoard.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ teamId: null })
    })
    expect(detachBoardResponse.status).toBe(200)
    expect(await detachBoardResponse.json()).toEqual(
      expect.objectContaining({
        id: personalBoard.id,
        teamId: null,
        team: null
      })
    )

    const memberBoardsAfterDetachResponse = await app.request('/api/boards', {
      headers: { [TEST_USER_HEADER]: editor.user.id }
    })
    expect(memberBoardsAfterDetachResponse.status).toBe(200)
    expect(await memberBoardsAfterDetachResponse.json()).toEqual({ boards: [] })

    const anonymousBoardResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Anonymous Board' })
    })
    expect(anonymousBoardResponse.status).toBe(201)

    const anonymousListResponse = await app.request('/api/boards', {
      headers: {
        'X-Inkly-Anonymous-Id': anonymousBoardResponse.headers.get('X-Inkly-Anonymous-Id') ?? ''
      }
    })
    expect(anonymousListResponse.status).toBe(200)
    expect(await anonymousListResponse.json()).toEqual({
      boards: [expect.objectContaining({ name: 'Anonymous Board', teamId: null, team: null })]
    })

    database.close()
  })
})
