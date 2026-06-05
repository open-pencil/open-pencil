import { describe, expect, test } from 'bun:test'

import { notifications } from '../../packages/api/src/db/schema.js'
import { DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS } from '../../packages/api/src/notificationStore.js'
import { TEST_API_SECRET, createTestApiApp } from '../helpers/api.js'
import { createSession, seedUsers } from '../helpers/api-auth.js'

const ONE_DAY_MS = 24 * 3600 * 1000

function insertNotification(
  database: ReturnType<typeof createTestApiApp>['database'],
  input: {
    id: string
    userId: string
    createdAt: number
  }
) {
  database.db
    .insert(notifications)
    .values({
      id: input.id,
      userId: input.userId,
      type: 'mention',
      payload: JSON.stringify({
        boardId: 'board-1',
        boardName: 'Roadmap',
        mentionedByDisplayName: 'Owner User',
        message: 'Please review',
        url: '/?board=board-1'
      }),
      readAt: null,
      createdAt: input.createdAt
    })
    .run()
}

describe('notification sweep', () => {
  test('removes notifications older than 30 days and keeps newer ones', () => {
    const now = new Date('2026-06-05T00:00:00.000Z').getTime()
    const user = createSession('user-1', 'Owner User', 'owner@example.com')
    const { database, notificationStore } = createTestApiApp({
      secret: TEST_API_SECRET,
      now: () => now
    })
    seedUsers(database, [user])

    insertNotification(database, {
      id: 'notification-old',
      userId: user.user.id,
      createdAt: now - 31 * ONE_DAY_MS
    })
    insertNotification(database, {
      id: 'notification-recent',
      userId: user.user.id,
      createdAt: now - 29 * ONE_DAY_MS
    })

    expect(
      notificationStore.sweepOldNotifications(DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS)
    ).toBe(1)
    expect(notificationStore.listNotificationsForUser(user.user.id)).toEqual([
      expect.objectContaining({ id: 'notification-recent' })
    ])

    database.close()
  })

  test('sweep endpoint deletes old notifications and returns the deleted count', async () => {
    const now = new Date('2026-06-05T00:00:00.000Z').getTime()
    const user = createSession('user-1', 'Owner User', 'owner@example.com')
    const { app, database, notificationStore } = createTestApiApp({
      secret: TEST_API_SECRET,
      now: () => now,
      env: {
        INKLY_API_SWEEP_TOKEN: 'dev-token'
      } as NodeJS.ProcessEnv
    })
    seedUsers(database, [user])

    insertNotification(database, {
      id: 'notification-old',
      userId: user.user.id,
      createdAt: now - 31 * ONE_DAY_MS
    })
    insertNotification(database, {
      id: 'notification-recent',
      userId: user.user.id,
      createdAt: now - 29 * ONE_DAY_MS
    })

    const response = await app.request('http://localhost/api/notifications/sweep', {
      method: 'POST',
      headers: {
        'X-Sweep-Token': 'dev-token'
      }
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deletedCount: 1 })
    expect(notificationStore.listNotificationsForUser(user.user.id)).toEqual([
      expect.objectContaining({ id: 'notification-recent' })
    ])

    database.close()
  })

  test('sweep endpoint rejects non-localhost requests', async () => {
    const { app, database } = createTestApiApp({
      secret: TEST_API_SECRET,
      env: {
        INKLY_API_SWEEP_TOKEN: 'dev-token'
      } as NodeJS.ProcessEnv
    })

    const response = await app.request('http://example.com/api/notifications/sweep', {
      method: 'POST',
      headers: {
        'X-Sweep-Token': 'dev-token'
      }
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: {
        code: 'forbidden',
        message: 'Sweep is only available from localhost'
      }
    })

    database.close()
  })

  test('sweep endpoint returns 503 when the sweep token is not configured', async () => {
    const { app, database } = createTestApiApp({
      secret: TEST_API_SECRET
    })

    const response = await app.request('http://localhost/api/notifications/sweep', {
      method: 'POST'
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: {
        code: 'sweep_unavailable',
        message: 'Sweep token is not configured'
      }
    })

    database.close()
  })
})
