import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-tests/helpers/account-authentication'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  accountSecurityErrorResponseSchema,
  cloudAccountDeletionResponseSchema,
  type WorkspaceRole
} from '#cloud/contract'
import { createDocumentCleanupService } from '#cloud/server/cleanup'

const PASSWORD = 'a sufficiently long password'

type Fixture = Awaited<ReturnType<typeof createAccountAuthenticationFixture>>

async function workspace(
  fixture: Fixture,
  name: string,
  ownerId: string,
  members: Array<[userId: string, role: WorkspaceRole, joinedAt?: Date]>
): Promise<string> {
  const id = crypto.randomUUID()
  await fixture.database
    .insertInto('workspace')
    .values({ id, name, slug: id, createdBy: ownerId, ownerId })
    .execute()
  for (const [userId, role, joinedAt] of members) {
    await fixture.database
      .insertInto('workspaceMember')
      .values({ workspaceId: id, userId, role, createdAt: joinedAt ?? new Date() })
      .execute()
  }
  return id
}

async function document(
  fixture: Fixture,
  workspaceId: string,
  name: string,
  createdBy: string,
  deletedAt: Date | null = null
): Promise<string> {
  const id = crypto.randomUUID()
  await fixture.database
    .insertInto('document')
    .values({ id, workspaceId, name, createdBy, deletedAt })
    .execute()
  return id
}

const deletion = async (fixture: Fixture, cookie: string) =>
  (
    await responseJSON(
      await fixture.app.fetch(
        accountAuthenticationRequest('/api/account/deletion', undefined, cookie)
      ),
      cloudAccountDeletionResponseSchema
    )
  ).deletion

const remove = (fixture: Fixture, cookie: string, body: { password?: string } = {}) =>
  fixture.app.fetch(accountAuthenticationRequest('/api/account/delete', body, cookie))

describe('account deletion', () => {
  test('waits for another admin, then takes the account’s own workspaces and leaves the rest', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const alice = await createVerifiedCredentialAccount(fixture, {
        email: 'alice@example.com',
        name: 'Alice',
        password: PASSWORD,
        approved: true
      })
      const bob = await createVerifiedCredentialAccount(fixture, {
        email: 'bob@example.com',
        name: 'Bob',
        password: PASSWORD,
        approved: true
      })
      const carol = await createVerifiedCredentialAccount(fixture, {
        email: 'carol@example.com',
        name: 'Carol',
        password: PASSWORD,
        approved: true
      })
      const solo = await workspace(fixture, 'Solo', alice.userId, [[alice.userId, 'admin']])
      const empty = await workspace(fixture, 'Empty', alice.userId, [[alice.userId, 'admin']])
      const earlier = new Date(Date.now() - 60_000)
      const shared = await workspace(fixture, 'Shared', alice.userId, [
        [alice.userId, 'admin', new Date(Date.now() - 120_000)],
        [carol.userId, 'admin'],
        [bob.userId, 'admin', earlier]
      ])
      const team = await workspace(fixture, 'Team', alice.userId, [
        [alice.userId, 'admin'],
        [bob.userId, 'editor']
      ])
      const soloDocument = await document(fixture, solo, 'Sketch', alice.userId)
      await document(fixture, solo, 'Old', alice.userId, new Date())
      const sharedDocument = await document(fixture, shared, 'Plan', alice.userId)
      const bobsDocument = await document(fixture, shared, 'Notes', bob.userId)
      await fixture.database
        .insertInto('documentGrant')
        .values({
          id: crypto.randomUUID(),
          documentId: bobsDocument,
          userId: alice.userId,
          permission: 'edit',
          createdBy: bob.userId
        })
        .execute()
      const invitation = crypto.randomUUID()
      await fixture.database
        .insertInto('workspaceInvitation')
        .values({
          id: invitation,
          workspaceId: shared,
          emailNormalized: 'dave@example.com',
          role: 'viewer',
          tokenHash: 'hash',
          invitedBy: alice.userId,
          expiresAt: new Date(Date.now() + 60_000)
        })
        .execute()
      await fixture.database
        .insertInto('accountEntitlement')
        .values({ userId: alice.userId, values: '{}', source: 'operator' })
        .execute()

      expect(await deletion(fixture, alice.sessionCookie)).toEqual({
        blockedBy: [{ id: team, name: 'Team' }],
        deletes: [
          { id: empty, name: 'Empty' },
          { id: solo, name: 'Solo' }
        ],
        leaves: [{ id: shared, name: 'Shared' }],
        documents: [
          { id: sharedDocument, name: 'Plan', workspaceName: 'Shared' },
          { id: soloDocument, name: 'Sketch', workspaceName: 'Solo' }
        ]
      })
      const blocked = await remove(fixture, alice.sessionCookie)
      expect(blocked.status).toBe(409)
      expect((await responseJSON(blocked, accountSecurityErrorResponseSchema)).error.code).toBe(
        'account_sole_admin'
      )
      // Refused, nothing moved.
      expect(
        await fixture.database
          .selectFrom('workspaceMember')
          .select('workspaceId')
          .where('userId', '=', alice.userId)
          .execute()
      ).toHaveLength(4)

      await fixture.database
        .updateTable('workspaceMember')
        .set({ role: 'admin' })
        .where('workspaceId', '=', team)
        .where('userId', '=', bob.userId)
        .execute()
      const deleted = await remove(fixture, alice.sessionCookie)
      expect(deleted.status).toBe(200)
      expect(deleted.headers.getSetCookie().join('\n')).toContain('Max-Age=0')

      const database = fixture.database
      expect(
        await database.selectFrom('user').select('id').where('id', '=', alice.userId).execute()
      ).toEqual([])
      // Its own workspaces: the empty one is gone, the other waits for cleanup with nobody in it.
      const workspaces = await database
        .selectFrom('workspace')
        .select(['id', 'ownerId'])
        .where('id', 'in', [solo, empty, shared, team])
        .execute()
      expect(new Map(workspaces.map((row) => [row.id, row.ownerId]))).toEqual(
        new Map([
          [solo, alice.userId],
          // The longest-standing other admin takes it over.
          [shared, bob.userId],
          [team, bob.userId]
        ])
      )
      expect(
        await database
          .selectFrom('document')
          .select('id')
          .where('workspaceId', '=', solo)
          .where('deletedAt', 'is', null)
          .execute()
      ).toEqual([])
      expect(
        await database
          .selectFrom('document')
          .select('id')
          .where('id', 'in', [sharedDocument, bobsDocument])
          .where('deletedAt', 'is', null)
          .execute()
      ).toHaveLength(2)
      expect(
        await database
          .selectFrom('workspaceMember')
          .select('workspaceId')
          .where('userId', '=', alice.userId)
          .execute()
      ).toEqual([])
      expect(
        await database
          .selectFrom('documentGrant')
          .select('id')
          .where('userId', '=', alice.userId)
          .execute()
      ).toEqual([])
      const sent = await database
        .selectFrom('workspaceInvitation')
        .select('revokedAt')
        .where('id', '=', invitation)
        .executeTakeFirstOrThrow()
      expect(sent.revokedAt).not.toBeNull()
      for (const table of ['accountEntitlement', 'signIn'] as const) {
        expect(
          await database
            .selectFrom(table)
            .select('userId')
            .where('userId', '=', alice.userId)
            .execute()
        ).toEqual([])
      }
      const enrollments = await database
        .selectFrom('enrollment')
        .select('emailNormalized')
        .execute()
      expect(enrollments.map((row) => row.emailNormalized).toSorted()).toEqual([
        'bob@example.com',
        'carol@example.com'
      ])

      // The cleanup worker purges its documents after retention, then the workspace with them.
      const cleanup = createDocumentCleanupService(database, createMemoryObjectStore().store)
      await cleanup.cleanupDeletedDocuments({
        batchSize: 10,
        leaseDurationMs: 60_000,
        retentionMs: 0,
        now: new Date(Date.now() + 1000)
      })
      expect(
        await database.selectFrom('workspace').select('id').where('id', '=', solo).execute()
      ).toEqual([])
    } finally {
      await fixture.close()
    }
  })

  test('asks a session that signed in a while ago for its password', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'stale@example.com',
        name: 'Stale',
        password: PASSWORD,
        approved: true
      })
      await fixture.database
        .updateTable('session')
        .set({ createdAt: new Date(Date.now() - 60 * 60_000) })
        .where('userId', '=', account.userId)
        .execute()
      const stale = await remove(fixture, account.sessionCookie)
      expect(stale.status).toBe(400)
      expect((await responseJSON(stale, accountSecurityErrorResponseSchema)).error.code).toBe(
        'session_not_fresh'
      )
      const wrong = await remove(fixture, account.sessionCookie, { password: 'not the password' })
      expect((await responseJSON(wrong, accountSecurityErrorResponseSchema)).error.code).toBe(
        'current_password_invalid'
      )
      expect((await remove(fixture, account.sessionCookie, { password: PASSWORD })).status).toBe(
        200
      )
      expect(
        await fixture.database
          .selectFrom('user')
          .select('id')
          .where('id', '=', account.userId)
          .execute()
      ).toEqual([])
    } finally {
      await fixture.close()
    }
  })

  test('is not reachable through Better Auth’s own endpoint', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'direct@example.com',
        name: 'Direct',
        password: PASSWORD,
        approved: true
      })
      const direct = await fixture.app.fetch(
        accountAuthenticationRequest('/api/auth/delete-user', {}, account.sessionCookie)
      )
      expect(direct.status).toBe(404)
      expect(
        await fixture.database
          .selectFrom('user')
          .select('id')
          .where('id', '=', account.userId)
          .execute()
      ).toHaveLength(1)
    } finally {
      await fixture.close()
    }
  })
})
