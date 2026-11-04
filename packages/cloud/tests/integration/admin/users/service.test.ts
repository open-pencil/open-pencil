import { describe, expect, test } from 'bun:test'

import { ignoredSecurityNotices } from '#cloud-tests/helpers/account-authentication'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { pngHeader } from '#cloud-tests/helpers/pictures'
import { createAdminAuditService, createAdminUserService } from '#cloud/server'
import { createUserPictures } from '#cloud/server/pictures'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

function complete(): Promise<void> {
  return Promise.resolve()
}

function authAdapter() {
  return {
    schemaVersion: 'test',
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
    emailChangeAvailable: false,
    async profile() {
      return null
    },
    updateProfile: complete,
    changeEmail: complete,
    async sessions() {
      return null
    },
    revokeSession: complete,
    revokeOtherSessions: complete,
    async signIns() {
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

  test('lists accounts by filter and search, with counts and what each one uses', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const SUSPENDED_ID = '33333333-3333-4333-8333-333333333333'
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
            banned: false,
            twoFactorEnabled: true,
            createdAt: new Date(Date.UTC(2026, 0, 1))
          },
          {
            id: USER_ID,
            name: 'Grace Hopper',
            email: 'grace@example.com',
            emailVerified: true,
            image: 'https://images.example.com/grace.png',
            role: 'user',
            banned: false,
            createdAt: new Date(Date.UTC(2026, 0, 2))
          },
          {
            id: SUSPENDED_ID,
            name: 'Suspended_Person',
            email: 'suspended@example.com',
            emailVerified: true,
            image: null,
            role: 'user',
            banned: true,
            banReason: 'Spam',
            createdAt: new Date(Date.UTC(2026, 0, 3))
          }
        ])
        .execute()
      await runtime.database
        .insertInto('passkey')
        .values({
          id: crypto.randomUUID(),
          name: 'Laptop',
          publicKey: 'key',
          userId: SUSPENDED_ID,
          credentialID: 'credential',
          counter: 0,
          deviceType: 'singleDevice',
          backedUp: false,
          transports: null,
          createdAt: new Date(),
          aaguid: null
        })
        .execute()
      const workspaceId = crypto.randomUUID()
      await runtime.database
        .insertInto('workspace')
        .values({ id: workspaceId, name: 'Studio', slug: 'studio', createdBy: USER_ID })
        .execute()
      await runtime.database
        .insertInto('workspaceMember')
        .values({ workspaceId, userId: USER_ID, role: 'admin' })
        .execute()
      const service = createAdminUserService(runtime.database, authAdapter())

      const everyone = await service.list()
      expect(everyone.users.map((user) => user.email)).toEqual([
        'admin@example.com',
        'grace@example.com',
        'suspended@example.com'
      ])
      expect(everyone.counts).toEqual({
        all: 3,
        administrators: 1,
        suspended: 1,
        'without-two-step': 1
      })
      expect(everyone.users.map((user) => user.twoStep)).toEqual([true, false, true])
      expect(everyone.users[1]).toMatchObject({
        image: 'https://images.example.com/grace.png',
        workspaceCount: 1,
        lastActiveAt: null
      })
      expect((await service.list({ filter: 'suspended' })).users).toEqual([
        expect.objectContaining({ id: SUSPENDED_ID, banReason: 'Spam' })
      ])
      expect(
        (await service.list({ filter: 'without-two-step' })).users.map((user) => user.id)
      ).toEqual([USER_ID])

      // A search matches names as well as emails, and its wildcards are plain characters.
      const searched = await service.list({ search: 'hopper' })
      expect(searched.users.map((user) => user.id)).toEqual([USER_ID])
      expect(searched.counts.all).toBe(1)
      expect((await service.list({ search: '_' })).users.map((user) => user.id)).toEqual([
        SUSPENDED_ID
      ])
      expect((await service.list({ limit: 1, offset: 1 })).users.map((user) => user.id)).toEqual([
        USER_ID
      ])

      const detail = await service.detail(USER_ID)
      expect(detail?.workspaces).toEqual([
        expect.objectContaining({ id: workspaceId, name: 'Studio', role: 'admin', memberCount: 1 })
      ])
      expect(await service.detail(crypto.randomUUID())).toBeNull()
    } finally {
      await runtime.close()
    }
  })

  test('resets another account’s two-step sign-in and records it', async () => {
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
            name: 'Locked Out',
            email: 'locked@example.com',
            emailVerified: true,
            image: null,
            role: 'user',
            banned: false,
            twoFactorEnabled: true
          }
        ])
        .execute()
      await runtime.database
        .insertInto('twoFactor')
        .values({
          id: crypto.randomUUID(),
          secret: 'secret',
          backupCodes: 'codes',
          userId: USER_ID
        })
        .execute()
      const notices: string[] = []
      const service = createAdminUserService(runtime.database, authAdapter(), {
        notify: {
          ...ignoredSecurityNotices,
          sendVerification: complete,
          sendPasswordReset: complete,
          sendPasswordChanged: complete,
          async sendTwoStepChanged(input) {
            notices.push(`${input.email}:${input.change}`)
          }
        }
      })
      await expect(service.resetTwoStep(ADMIN_ID, ADMIN_ID)).rejects.toThrow('themselves')

      await service.resetTwoStep(ADMIN_ID, USER_ID)
      const user = await runtime.database
        .selectFrom('user')
        .select('twoFactorEnabled')
        .where('id', '=', USER_ID)
        .executeTakeFirstOrThrow()
      expect(user.twoFactorEnabled).toBe(false)
      const factors = await runtime.database
        .selectFrom('twoFactor')
        .select('id')
        .where('userId', '=', USER_ID)
        .execute()
      expect(factors).toEqual([])
      expect(notices).toEqual(['locked@example.com:reset-by-administrator'])
      const { events } = await createAdminAuditService(runtime.database).list()
      expect(events).toEqual([
        expect.objectContaining({
          action: 'user.two-step-reset',
          actor: { id: ADMIN_ID, name: 'Admin' },
          subject: { type: 'user', id: USER_ID, name: 'Locked Out' }
        })
      ])
    } finally {
      await runtime.close()
    }
  })

  test('takes down a person’s picture and records it', async () => {
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
            name: 'Pictured',
            email: 'pictured@example.com',
            emailVerified: true,
            image: null,
            role: 'user',
            banned: false
          }
        ])
        .execute()
      const pictures = createUserPictures(runtime.database, {
        publicURL: 'https://cloud.example.com'
      })
      await pictures.upload(USER_ID, pngHeader(256, 256))
      await expect(
        createAdminUserService(runtime.database, authAdapter()).removePicture(ADMIN_ID, USER_ID)
      ).rejects.toThrow('not available')

      const service = createAdminUserService(runtime.database, authAdapter(), { pictures })
      await service.removePicture(ADMIN_ID, USER_ID)
      const user = await runtime.database
        .selectFrom('user')
        .select('image')
        .where('id', '=', USER_ID)
        .executeTakeFirstOrThrow()
      expect(user.image).toBeNull()
      const kept = await runtime.database.selectFrom('userPicture').select('userId').execute()
      expect(kept).toEqual([])
      expect((await createAdminAuditService(runtime.database).list()).events).toEqual([
        expect.objectContaining({
          action: 'user.picture-removed',
          subject: { type: 'user', id: USER_ID, name: 'Pictured' }
        })
      ])
    } finally {
      await runtime.close()
    }
  })
})
