import { afterEach, describe, expect, test } from 'bun:test'

import { startApiServer } from '../../packages/api/src/server.js'
import { TEST_USER_HEADER, createHeaderAuth, createSession, seedUsers } from '../helpers/api-auth.js'
import { TEST_API_SECRET, createTestApiDatabase } from '../helpers/api.js'

type NotificationPushMessage = {
  type: 'notification.created'
  notification: {
    id: string
    userId: string
    type: string
    payload: {
      boardId: string
      boardName: string
      mentionedByDisplayName: string
      message: string
      url: string
    }
  }
}

type TestSocket = {
  socket: WebSocket
  nextMessage: () => Promise<NotificationPushMessage>
}

const sockets = new Set<WebSocket>()
const servers: Array<{ stop: () => void }> = []
const databases: Array<{ close: () => void } | null> = []

afterEach(() => {
  for (const socket of sockets) {
    socket.close()
  }
  sockets.clear()

  for (const server of servers.splice(0)) {
    server.stop()
  }

  for (const database of databases.splice(0)) {
    database?.close()
  }
})

function connect(url: string, userId: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      url,
      {
        headers: {
          [TEST_USER_HEADER]: userId
        }
      } as never
    )
    const queue: NotificationPushMessage[] = []
    const waiters: Array<(message: NotificationPushMessage) => void> = []
    sockets.add(socket)

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as NotificationPushMessage
      const waiter = waiters.shift()
      if (waiter) waiter(message)
      else queue.push(message)
    })
    socket.addEventListener(
      'open',
      () =>
        resolve({
          socket,
          nextMessage: () =>
            new Promise((nextResolve) => {
              const queued = queue.shift()
              if (queued) {
                nextResolve(queued)
                return
              }
              waiters.push(nextResolve)
            })
        }),
      { once: true }
    )
    socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), {
      once: true
    })
  })
}

describe('mention notification route', () => {
  test('creates a mention notification and pushes it over websocket', async () => {
    const owner = createSession('user-owner', 'Owner User', 'owner@example.com')
    const teammate = createSession('user-teammate', 'Teammate User', 'teammate@example.com')
    const database = createTestApiDatabase()
    seedUsers(database, [owner, teammate])

    const { app, server } = startApiServer({
      secret: TEST_API_SECRET,
      host: '127.0.0.1',
      port: 0,
      auth: createHeaderAuth([owner, teammate]),
      database
    })
    servers.push(server)
    databases.push(database)

    const createTeamResponse = await app.request('/api/teams', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({ name: 'Studio Alpha' })
    })
    expect(createTeamResponse.status).toBe(201)
    const team = (await createTeamResponse.json()) as { id: string }

    const addMemberResponse = await app.request(`/api/teams/${team.id}/members`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({
        userId: teammate.user.id,
        role: 'editor'
      })
    })
    expect(addMemberResponse.status).toBe(201)

    const createBoardResponse = await app.request('/api/boards', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({
        name: 'Roadmap board',
        teamId: team.id
      })
    })
    expect(createBoardResponse.status).toBe(201)
    const board = (await createBoardResponse.json()) as { id: string; name: string }

    const socket = await connect(
      `ws://127.0.0.1:${server.port}/api/ws/notifications`,
      teammate.user.id
    )

    const mentionResponse = await app.request('/api/notifications/mention', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TEST_USER_HEADER]: owner.user.id
      },
      body: JSON.stringify({
        boardId: board.id,
        mentionedUserId: teammate.user.id,
        sourceUserId: owner.user.id,
        text: 'Please review @teammate@example.com before launch'
      })
    })
    expect(mentionResponse.status).toBe(201)
    const mentionBody = (await mentionResponse.json()) as {
      notification: NotificationPushMessage['notification']
    }
    expect(mentionBody.notification).toEqual(
      expect.objectContaining({
        userId: teammate.user.id,
        type: 'mention',
        payload: expect.objectContaining({
          boardId: board.id,
          boardName: board.name,
          mentionedByDisplayName: owner.user.name,
          message: 'Please review @teammate@example.com before launch',
          url: expect.stringContaining(`board=${board.id}`)
        })
      })
    )

    await expect(socket.nextMessage()).resolves.toEqual({
      type: 'notification.created',
      notification: mentionBody.notification
    })
  })
})
