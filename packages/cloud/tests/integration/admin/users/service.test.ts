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
    async resolveAccountSession() {
      return null
    },
    async twoStepConfirmed() {
      return true
    },
    async resolveAccessToken() {
      return null
    },
    async listAccessTokens() {
      return []
    },
    async createAccessToken() {
      throw new Error('Access tokens are not used here')
    },
    async revokeAccessToken() {
      throw new Error('Access tokens are not used here')
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
    async deleteAccount() {
      return new Headers()
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
    setLocale: complete,
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
      // The administrator and the suspended account use a password; Grace, Google and Apple.
      await runtime.database
        .insertInto('account')
        .values(
          (
            [
              [ADMIN_ID, 'credential'],
              [USER_ID, 'google'],
              [USER_ID, 'apple'],
              [SUSPENDED_ID, 'credential']
            ] as const
          ).map(([userId, providerId], index) => ({
            id: crypto.randomUUID(),
            userId,
            providerId,
            accountId: `${providerId}-${userId}`,
            createdAt: new Date(Date.UTC(2026, 0, 1 + index)),
            updatedAt: new Date()
          }))
        )
        .execute()
      const workspaceId = crypto.randomUUID()
      await runtime.database
        .insertInto('workspace')
        .values({
          id: workspaceId,
          name: 'Studio',
          slug: 'studio',
          createdBy: USER_ID,
          ownerId: USER_ID
        })
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
        'without-two-step': 1,
        password: 2,
        google: 1,
        apple: 1
      })
      expect(everyone.users.map((user) => user.twoStep)).toEqual([true, false, true])
      expect(everyone.users.map((user) => user.methods)).toEqual([
        ['credential'],
        ['google', 'apple'],
        ['credential']
      ])
      expect((await service.list({ filter: 'apple' })).users.map((user) => user.id)).toEqual([
        USER_ID
      ])
      expect((await service.list({ filter: 'password' })).users.map((user) => user.id)).toEqual([
        ADMIN_ID,
        SUSPENDED_ID
      ])
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

      // Where everyone may join, the list says nothing about requests.
      expect(everyone.users.every((user) => user.request === undefined)).toBe(true)
      // Where people are approved, an account that signed in but waits shows its request.
      await runtime.database
        .insertInto('enrollment')
        .values([
          { id: crypto.randomUUID(), emailNormalized: 'admin@example.com', status: 'approved' },
          { id: crypto.randomUUID(), emailNormalized: 'grace@example.com', status: 'pending' }
        ])
        .execute()
      const approving = createAdminUserService(runtime.database, authAdapter(), { approval: true })
      expect((await approving.list()).users.map((user) => user.request)).toEqual([
        'approved',
        'pending',
        null
      ])

      const detail = await service.detail(USER_ID)
      expect(detail?.workspaces).toEqual([
        expect.objectContaining({ id: workspaceId, name: 'Studio', role: 'admin', memberCount: 1 })
      ])
      expect(detail?.methods.map((method) => method.provider)).toEqual(['google', 'apple'])
      expect(detail?.methods.every((method) => method.id.length > 0)).toBe(true)
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

  test('removes a sign-in method from another account, keeping its last, and says so', async () => {
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
            role: 'admin'
          },
          {
            id: USER_ID,
            name: 'Grace',
            email: 'grace@example.com',
            emailVerified: true,
            role: 'user'
          }
        ])
        .execute()
      const [password, google, adminPassword] = [
        { id: crypto.randomUUID(), userId: USER_ID, providerId: 'credential' },
        { id: crypto.randomUUID(), userId: USER_ID, providerId: 'google' },
        { id: crypto.randomUUID(), userId: ADMIN_ID, providerId: 'credential' }
      ]
      await runtime.database
        .insertInto('account')
        .values(
          [password, google, adminPassword].map((method) => ({
            ...method,
            accountId: method.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        )
        .execute()
      const notices: string[] = []
      const service = createAdminUserService(runtime.database, authAdapter(), {
        notify: {
          ...ignoredSecurityNotices,
          sendVerification: complete,
          sendPasswordReset: complete,
          sendPasswordChanged: complete,
          async sendTwoStepChanged(input) {
            notices.push(`${input.email}:${input.change}:${input.method}`)
          }
        }
      })

      // An administrator changes their own on their security page.
      await expect(
        service.removeSignInMethod(ADMIN_ID, ADMIN_ID, adminPassword.id)
      ).rejects.toThrow('themselves')
      // A method of another account names nothing here.
      await expect(
        service.removeSignInMethod(ADMIN_ID, USER_ID, adminPassword.id)
      ).rejects.toThrow()

      await service.removeSignInMethod(ADMIN_ID, USER_ID, google.id)
      const left = await runtime.database
        .selectFrom('account')
        .select('providerId')
        .where('userId', '=', USER_ID)
        .execute()
      expect(left).toEqual([{ providerId: 'credential' }])
      expect(notices).toEqual(['grace@example.com:sign-in-method-removed:google'])

      // The account keeps a way in.
      await expect(
        service.removeSignInMethod(ADMIN_ID, USER_ID, password.id)
      ).rejects.toMatchObject({ code: 'last_authentication_method' })
      expect(notices).toHaveLength(1)

      const { events } = await createAdminAuditService(runtime.database).list()
      expect(events).toEqual([
        expect.objectContaining({
          action: 'user.sign-in-method-removed',
          actor: { id: ADMIN_ID, name: 'Admin' },
          subject: { type: 'user', id: USER_ID, name: 'Grace' },
          metadata: { provider: 'google' }
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
