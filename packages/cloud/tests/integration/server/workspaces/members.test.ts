import { describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import {
  createCloudApp,
  createBetterAuthAdapter,
  INVITATION_BUDGET,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import * as v from 'valibot'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  trustedOrigins: ['https://app.example.com'],
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

const people = {
  alice: { userId: crypto.randomUUID(), email: 'alice@example.com', name: 'Alice' },
  bob: { userId: crypto.randomUUID(), email: 'bob@example.com', name: 'Bob' },
  carol: { userId: crypto.randomUUID(), email: 'carol@example.com', name: 'Carol' }
} satisfies Record<string, CloudActor>

async function testApp() {
  const runtime = await createCloudTestDatabase()
  await runtime.database
    .insertInto('user')
    .values(
      Object.values(people).map((person) => ({
        id: person.userId,
        name: person.name,
        email: person.email,
        emailVerified: true,
        image: null
      }))
    )
    .execute()
  let actor: CloudActor = people.alice
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => actor
  })
  return {
    runtime,
    /** The contract's client, acting as `person`. */
    as(person: CloudActor) {
      actor = person
      return contractClient(app, { Origin: config.publicURL })
    }
  }
}

const invitationsByWhomSchema = v.object({
  invitations: v.array(
    v.object({
      id: v.string(),
      invitedBy: v.object({ id: v.string(), name: v.nullable(v.string()) })
    })
  )
})

describe('workspace members', () => {
  test('invites by email, joins through the invitation link, and keeps an administrator', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await as(people.alice).workspaces.create({ body: { name: 'Studio' } })
      const workspaceId = created.workspace.id
      expect(created.workspace.role).toBe('admin')

      const invited = await as(people.alice).workspaces.invite({
        params: { workspaceId },
        body: { email: ' Bob@Example.com ', role: 'editor' }
      })
      expect(invited.invitation).toMatchObject({ email: 'bob@example.com', role: 'editor' })
      const link = new URL(invited.acceptanceURL)
      expect(link.origin).toBe('https://cloud.example.com')
      expect(link.pathname).toBe(`/invitations/${invited.invitation.id}`)
      const token = link.hash.slice(1)

      const listed = await as(people.alice).workspaces.members({ params: { workspaceId } })
      expect(listed.members.map((member) => member.email)).toEqual(['alice@example.com'])
      expect(listed.invitations.map((invitation) => invitation.email)).toEqual(['bob@example.com'])

      expect(
        await as(people.bob).publicSharing.previewInvitation({
          params: { invitationId: invited.invitation.id },
          body: { token }
        })
      ).toMatchObject({
        invitation: {
          kind: 'workspace',
          workspaceName: 'Studio',
          role: 'editor',
          inviterName: 'Alice'
        }
      })

      expect(
        await outcome(
          as(people.carol).sharing.acceptInvitation({
            params: { invitationId: invited.invitation.id },
            body: { token }
          })
        )
      ).toMatchObject({ status: 404 })

      expect(
        await as(people.bob).sharing.acceptInvitation({
          params: { invitationId: invited.invitation.id },
          body: { token }
        })
      ).toEqual({
        accepted: { kind: 'workspace', workspaceId, role: 'editor' }
      })
      const bobsWorkspaces = await as(people.bob).workspaces.list()
      // A member who joined doesn't own it, so the editor sends them to the owner for credits.
      expect(bobsWorkspaces.workspaces).toContainEqual(
        expect.objectContaining({ id: workspaceId, owner: false })
      )

      // Members other than administrators see who is in, not who is invited.
      const asMember = await as(people.bob).workspaces.members({ params: { workspaceId } })
      expect(asMember.members.map((member) => member.email)).toEqual([
        'alice@example.com',
        'bob@example.com'
      ])
      expect(asMember.invitations).toEqual([])
      expect(
        await outcome(
          as(people.bob).workspaces.invite({
            params: { workspaceId },
            body: { email: 'carol@example.com', role: 'viewer' }
          })
        )
      ).toMatchObject({ status: 403 })

      const alice = { workspaceId, userId: people.alice.userId }
      expect(
        await outcome(
          as(people.alice).workspaces.updateMember({ params: alice, body: { role: 'editor' } })
        )
      ).toMatchObject({ status: 409 })
      expect(
        await outcome(as(people.alice).workspaces.removeMember({ params: alice }))
      ).toMatchObject({ status: 409 })

      expect(
        await outcome(
          as(people.bob).workspaces.removeMember({
            params: { workspaceId, userId: people.bob.userId }
          })
        )
      ).toBe('ok')
      expect(
        await outcome(as(people.bob).workspaces.members({ params: { workspaceId } }))
      ).toMatchObject({ status: 404 })
    } finally {
      await runtime.close()
    }
  })

  test('answers 429 past the recipient’s daily budget, which deleting the workspace keeps', async () => {
    const { runtime, as } = await testApp()
    try {
      const create = async (name: string) =>
        (await as(people.alice).workspaces.create({ body: { name } })).workspace.id
      const invite = (workspaceId: string) =>
        outcome(
          as(people.alice).workspaces.invite({
            params: { workspaceId },
            body: { email: 'target@example.com', role: 'viewer' }
          })
        )
      const first = await create('First')
      for (let sent = 0; sent < INVITATION_BUDGET.perRecipient; sent++) {
        expect(await invite(first)).toBe('ok')
      }
      expect(await invite(first)).toEqual({ status: 429, code: 'rate_limited' })

      expect(
        await outcome(as(people.alice).workspaces.remove({ params: { workspaceId: first } }))
      ).toBe('ok')
      expect(await invite(await create('Second'))).toMatchObject({ status: 429 })
    } finally {
      await runtime.close()
    }
  })

  test('passes the workspace to the longest-standing other admin when its owner goes', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await as(people.alice).workspaces.create({ body: { name: 'Studio' } })
      const workspaceId = created.workspace.id
      await runtime.database
        .insertInto('workspaceMember')
        .values([
          {
            workspaceId,
            userId: people.carol.userId,
            role: 'admin',
            createdAt: new Date('2026-02-01T00:00:00Z')
          },
          {
            workspaceId,
            userId: people.bob.userId,
            role: 'admin',
            createdAt: new Date('2026-01-01T00:00:00Z')
          }
        ])
        .execute()
      const owner = async () =>
        (
          await runtime.database
            .selectFrom('workspace')
            .select('ownerId')
            .where('id', '=', workspaceId)
            .executeTakeFirstOrThrow()
        ).ownerId
      expect(await owner()).toBe(people.alice.userId)

      await as(people.alice).workspaces.removeMember({
        params: { workspaceId, userId: people.alice.userId }
      })
      expect(await owner()).toBe(people.bob.userId)

      await as(people.carol).workspaces.updateMember({
        params: { workspaceId, userId: people.bob.userId },
        body: { role: 'editor' }
      })
      expect(await owner()).toBe(people.carol.userId)
    } finally {
      await runtime.close()
    }
  })

  test('replaces an earlier invitation to the same address and lets an administrator withdraw it', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await as(people.alice).workspaces.create({ body: { name: 'Studio' } })
      const workspaceId = created.workspace.id
      const invite = (role: 'viewer' | 'editor') =>
        as(people.alice).workspaces.invite({
          params: { workspaceId },
          body: { email: 'bob@example.com', role }
        })
      const first = await invite('viewer')
      const second = await invite('editor')

      expect(
        await outcome(
          as(people.bob).sharing.acceptInvitation({
            params: { invitationId: first.invitation.id },
            body: { token: new URL(first.acceptanceURL).hash.slice(1) }
          })
        )
      ).toMatchObject({ status: 404 })

      await as(people.alice).workspaces.revokeInvitation({
        params: { workspaceId, invitationId: second.invitation.id }
      })
      const listed = await as(people.alice).workspaces.members({ params: { workspaceId } })
      expect(listed.invitations).toEqual([])
    } finally {
      await runtime.close()
    }
  })
  test('resends a waiting invitation under a new link and names who sent it', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await as(people.alice).workspaces.create({ body: { name: 'Studio' } })
      const workspaceId = created.workspace.id
      const first = await as(people.alice).workspaces.invite({
        params: { workspaceId },
        body: { email: 'bob@example.com', role: 'viewer' }
      })
      const resent = await as(people.alice).workspaces.resendInvitation({
        params: { workspaceId, invitationId: first.invitation.id }
      })
      expect(resent.invitation).toMatchObject({ email: 'bob@example.com', role: 'viewer' })
      expect(resent.invitation.id).not.toBe(first.invitation.id)
      const listed = v.parse(
        invitationsByWhomSchema,
        await as(people.alice).workspaces.members({ params: { workspaceId } })
      )
      expect(listed.invitations).toEqual([
        { id: resent.invitation.id, invitedBy: { id: people.alice.userId, name: 'Alice' } }
      ])

      expect(
        await outcome(
          as(people.bob).sharing.acceptInvitation({
            params: { invitationId: first.invitation.id },
            body: { token: new URL(first.acceptanceURL).hash.slice(1) }
          })
        )
      ).toMatchObject({ status: 404 })
      expect(
        await outcome(
          as(people.bob).sharing.acceptInvitation({
            params: { invitationId: resent.invitation.id },
            body: { token: new URL(resent.acceptanceURL).hash.slice(1) }
          })
        )
      ).toBe('ok')

      expect(
        await outcome(
          as(people.alice).workspaces.resendInvitation({
            params: { workspaceId, invitationId: resent.invitation.id }
          })
        )
      ).toMatchObject({ status: 404 })
      expect(
        await outcome(
          as(people.bob).workspaces.resendInvitation({
            params: { workspaceId, invitationId: first.invitation.id }
          })
        )
      ).toMatchObject({ status: 403 })
    } finally {
      await runtime.close()
    }
  })
  test('deletes a workspace only once it holds no documents', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await as(people.alice).workspaces.create({ body: { name: 'Studio' } })
      const workspaceId = created.workspace.id
      const documentId = crypto.randomUUID()
      await runtime.database
        .insertInto('document')
        .values({ id: documentId, workspaceId, name: 'Poster', createdBy: people.alice.userId })
        .execute()
      const remove = () => outcome(as(people.alice).workspaces.remove({ params: { workspaceId } }))

      expect(await remove()).toEqual({ status: 409, code: 'not_empty' })

      await runtime.database
        .updateTable('document')
        .set({ deletedAt: new Date() })
        .where('id', '=', documentId)
        .execute()
      expect(await remove()).toMatchObject({ code: 'cleanup_pending' })

      await runtime.database.deleteFrom('document').where('id', '=', documentId).execute()
      expect(
        await outcome(as(people.bob).workspaces.remove({ params: { workspaceId } }))
      ).toMatchObject({ status: 404 })
      expect(await remove()).toBe('ok')
      expect(
        await outcome(as(people.alice).workspaces.get({ params: { workspaceId } }))
      ).toMatchObject({ status: 404 })
    } finally {
      await runtime.close()
    }
  })
})
