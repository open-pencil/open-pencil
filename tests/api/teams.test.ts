import { describe, expect, test } from 'bun:test'

import { TEST_API_SECRET, createTestApiApp } from '../helpers/api.js'
import { TEST_USER_HEADER, createHeaderAuth, createSession, seedUsers } from '../helpers/api-auth.js'

describe('team routes', () => {
  test('supports team CRUD, member management, role checks, and rehomes boards on delete', async () => {
    const owner = createSession('user-owner', 'Owner User', 'owner@example.com')
    const editor = createSession('user-editor', 'Editor User', 'editor@example.com')
    const viewer = createSession('user-viewer', 'Viewer User', 'viewer@example.com')
    const outsider = createSession('user-outsider', 'Outsider User', 'outsider@example.com')
    const { app, boardStore, database } = await createTestApiApp({
      auth: createHeaderAuth([owner, editor, viewer, outsider]),
      secret: TEST_API_SECRET
    })
    await seedUsers(database, [owner, editor, viewer, outsider])

    const createTeamResponse = await app.request('/api/teams', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ name: 'Design Ops' })
    })
    expect(createTeamResponse.status).toBe(201)
    const createdTeam = (await createTeamResponse.json()) as {
      id: string
      name: string
      role: string
      memberCount: number
    }
    expect(createdTeam).toEqual(
      expect.objectContaining({
        name: 'Design Ops',
        role: 'owner',
        memberCount: 1
      })
    )

    const listTeamsResponse = await app.request('/api/teams', {
      headers: { [TEST_USER_HEADER]: owner.user.id }
    })
    expect(listTeamsResponse.status).toBe(200)
    expect(await listTeamsResponse.json()).toEqual({
      teams: [expect.objectContaining({ id: createdTeam.id, role: 'owner', boardCount: 0 })]
    })

    const ownerDetailResponse = await app.request(`/api/teams/${createdTeam.id}`, {
      headers: { [TEST_USER_HEADER]: owner.user.id }
    })
    expect(ownerDetailResponse.status).toBe(200)
    expect(await ownerDetailResponse.json()).toEqual({
      team: expect.objectContaining({
        id: createdTeam.id,
        role: 'owner',
        memberCount: 1,
        boardCount: 0
      }),
      members: [expect.objectContaining({ userId: owner.user.id, role: 'owner' })],
      boards: []
    })

    const addEditorResponse = await app.request(`/api/teams/${createdTeam.id}/members`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({
        email: editor.user.email,
        role: 'editor'
      })
    })
    expect(addEditorResponse.status).toBe(201)
    expect(await addEditorResponse.json()).toEqual({
      member: expect.objectContaining({
        userId: editor.user.id,
        role: 'editor'
      })
    })

    const addViewerResponse = await app.request(`/api/teams/${createdTeam.id}/members`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({
        userId: viewer.user.id,
        role: 'viewer'
      })
    })
    expect(addViewerResponse.status).toBe(201)

    const nonOwnerInviteResponse = await app.request(`/api/teams/${createdTeam.id}/members`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: editor.user.id
      },
      body: JSON.stringify({
        userId: outsider.user.id,
        role: 'viewer'
      })
    })
    expect(nonOwnerInviteResponse.status).toBe(403)

    const outsiderDetailResponse = await app.request(`/api/teams/${createdTeam.id}`, {
      headers: { [TEST_USER_HEADER]: outsider.user.id }
    })
    expect(outsiderDetailResponse.status).toBe(403)

    const updateViewerRoleResponse = await app.request(
      `/api/teams/${createdTeam.id}/members/${viewer.user.id}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          [TEST_USER_HEADER]: owner.user.id
        },
        body: JSON.stringify({ role: 'editor' })
      }
    )
    expect(updateViewerRoleResponse.status).toBe(200)
    expect(await updateViewerRoleResponse.json()).toEqual({
      member: expect.objectContaining({
        userId: viewer.user.id,
        role: 'editor'
      })
    })

    const personalBoardResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ name: 'Owner board' })
    })
    expect(personalBoardResponse.status).toBe(201)
    const personalBoard = (await personalBoardResponse.json()) as { id: string }

    const attachBoardResponse = await app.request(`/api/boards/${personalBoard.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ teamId: createdTeam.id })
    })
    expect(attachBoardResponse.status).toBe(200)
    expect(await attachBoardResponse.json()).toEqual(
      expect.objectContaining({
        id: personalBoard.id,
        teamId: createdTeam.id,
        team: {
          id: createdTeam.id,
          name: 'Design Ops'
        }
      })
    )

    const viewerLeaveResponse = await app.request(`/api/teams/${createdTeam.id}/leave`, {
      method: 'POST',
      headers: { [TEST_USER_HEADER]: viewer.user.id }
    })
    expect(viewerLeaveResponse.status).toBe(200)
    expect(await viewerLeaveResponse.json()).toEqual({ left: true })

    const ownerLeaveResponse = await app.request(`/api/teams/${createdTeam.id}/leave`, {
      method: 'POST',
      headers: { [TEST_USER_HEADER]: owner.user.id }
    })
    expect(ownerLeaveResponse.status).toBe(400)

    const removeEditorResponse = await app.request(
      `/api/teams/${createdTeam.id}/members/${editor.user.id}`,
      {
        method: 'DELETE',
        headers: { [TEST_USER_HEADER]: owner.user.id }
      }
    )
    expect(removeEditorResponse.status).toBe(200)
    expect(await removeEditorResponse.json()).toEqual({
      member: expect.objectContaining({ userId: editor.user.id, role: 'editor' })
    })

    const renameResponse = await app.request(`/api/teams/${createdTeam.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ name: 'Studio Ops' })
    })
    expect(renameResponse.status).toBe(200)
    expect(await renameResponse.json()).toEqual(
      expect.objectContaining({
        id: createdTeam.id,
        name: 'Studio Ops'
      })
    )

    const deleteTeamResponse = await app.request(`/api/teams/${createdTeam.id}`, {
      method: 'DELETE',
      headers: { [TEST_USER_HEADER]: owner.user.id }
    })
    expect(deleteTeamResponse.status).toBe(200)
    expect(await deleteTeamResponse.json()).toEqual({
      deleted: true,
      rehomedBoardCount: 1
    })

    expect(await boardStore.findBoard(personalBoard.id)).toEqual(
      expect.objectContaining({
        id: personalBoard.id,
        creatorUserId: owner.user.id,
        teamId: null
      })
    )

    const finalListResponse = await app.request('/api/teams', {
      headers: { [TEST_USER_HEADER]: owner.user.id }
    })
    expect(finalListResponse.status).toBe(200)
    expect(await finalListResponse.json()).toEqual({ teams: [] })

    database.close()
  })
})
