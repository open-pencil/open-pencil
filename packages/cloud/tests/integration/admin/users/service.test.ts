import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import { createAdminUserService } from '@open-pencil/cloud/server'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

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
    async listAuthenticationMethods() {
      return []
    },
    async changePassword() {
      return complete()
    },
    async startSocialLink() {
      return 'https://accounts.example.com/link'
    },
    async unlinkAuthenticationMethod() {
      return complete()
    },
    async mfaStatus() {
      return null
    },
    async enableTOTP() {
      return { totpURI: '', backupCodes: [] }
    },
    async verifyTOTP() {
      return undefined
    },
    async verifyRecoveryCode() {
      return undefined
    },
    async generateRecoveryCodes() {
      return []
    },
    async disableTOTP() {
      return complete()
    },
    async listPasskeys() {
      return []
    },
    async deletePasskey() {
      return complete()
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
        .values([
          {
            id: ADMIN_ID,
            name: 'Admin',
            email: 'admin@example.com',
            emailVerified: true,
            image: null,
            role: 'admin',
            banned: false
          },
          {
            id: USER_ID,
            name: 'User',
            email: 'user@example.com',
            emailVerified: true,
            image: null,
            role: 'user',
            banned: false
          }
        ])
        .execute()
      const service = createAdminUserService(runtime.database, authAdapter())
      await expect(service.ban(new Headers(), ADMIN_ID, ADMIN_ID)).rejects.toThrow(
        'cannot ban themselves'
      )
      await expect(service.setAdmin(new Headers(), 'other-admin', ADMIN_ID, false)).rejects.toThrow(
        'last deployment administrator'
      )

      const protectedService = createAdminUserService(runtime.database, authAdapter(), {
        requireMFA: true
      })
      await expect(
        protectedService.setAdmin(new Headers(), ADMIN_ID, USER_ID, true)
      ).rejects.toThrow('enroll MFA')
      await runtime.database
        .updateTable('user')
        .set({ twoFactorEnabled: true })
        .where('id', '=', USER_ID)
        .execute()
      await expect(
        protectedService.setAdmin(new Headers(), ADMIN_ID, USER_ID, true)
      ).resolves.toBeUndefined()
    } finally {
      await runtime.close()
    }
  })
})
