import { afterEach, describe, expect, test } from 'bun:test'

import { startApiServer } from '../../packages/api/src/server.js'
import { TEST_USER_HEADER, createHeaderAuth, createSession, seedUsers } from '../helpers/api-auth.js'
import { TEST_API_SECRET, createTestApiDatabase } from '../helpers/api.js'

const TEST_NOTIFICATIONS_WS_PORT = 18_102
const SKIP_NON_TTY_WEBSOCKET_TESTS = !process.stdout.isTTY

type NotificationPushMessage = {
  type: 'notification.created'
  notification: {
    id: string
    userId: string
    type: string
    payload: Record<string, unknown>
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

describe('notification websocket', () => {
  test.skipIf(SKIP_NON_TTY_WEBSOCKET_TESTS).serial(
    'pushes created notifications to every open socket for the same user',
    async () => {
    const sender = createSession('user-sender', 'Sender User', 'sender@example.com')
    const recipient = createSession('user-recipient', 'Recipient User', 'recipient@example.com')
    const database = await createTestApiDatabase()
    await seedUsers(database, [sender, recipient])

    const { notificationStore, server } = await startApiServer({
      secret: TEST_API_SECRET,
      host: '127.0.0.1',
      port: TEST_NOTIFICATIONS_WS_PORT,
      auth: createHeaderAuth([sender, recipient]),
      database
    })
    servers.push(server)
    databases.push(database)

    const url = `ws://127.0.0.1:${server.port}/api/ws/notifications`
    const first = await connect(url, recipient.user.id)
    const second = await connect(url, recipient.user.id)

    const notification = await notificationStore.createNotification({
      userId: recipient.user.id,
      type: 'mention',
      payload: {
        boardId: 'board-123',
        boardName: 'Release board',
        mentionedByDisplayName: sender.user.name,
        message: 'Please review the latest mock',
        url: '/?board=board-123'
      }
    })

    await expect(first.nextMessage()).resolves.toEqual({
      type: 'notification.created',
      notification
    })
    await expect(second.nextMessage()).resolves.toEqual({
      type: 'notification.created',
      notification
    })
    }
  )
})
