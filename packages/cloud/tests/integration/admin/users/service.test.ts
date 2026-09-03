import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import { createAdminUserService } from '@open-pencil/cloud/server'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'

function complete(): Promise<void> {
  return Promise.resolve()
}

function authAdapter() {
  return {
    schemaVersion: 'test',
    async listUsers() {
      return { users: [], total: 0 }
    },
    async banUser() {
      return complete()
    },
    async unbanUser() {
      return complete()
    },
    async revokeUserSessions() {
      return complete()
    },
    async setRole() {
      return complete()
    },
    async handler() {
      return new Response()
    },
    async resolveIdentity() {
      return null
    },
    async resolveSession() {
      return null
    },
    async migrate() {
      return complete()
    }
  }
}

describe('deployment admin user safety', () => {
  test('prevents self-ban and removal of the last administrator', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      await runtime.database
        .insertInto('user')
        .values({
          id: ADMIN_ID,
          name: 'Admin',
          email: 'admin@example.com',
          emailVerified: true,
          image: null,
          role: 'admin',
          banned: false
        })
        .execute()
      const service = createAdminUserService(runtime.database, authAdapter())
      await expect(service.ban(new Headers(), ADMIN_ID, ADMIN_ID)).rejects.toThrow(
        'cannot ban themselves'
      )
      await expect(service.setAdmin(new Headers(), 'other-admin', ADMIN_ID, false)).rejects.toThrow(
        'last deployment administrator'
      )
    } finally {
      await runtime.close()
    }
  })
})
