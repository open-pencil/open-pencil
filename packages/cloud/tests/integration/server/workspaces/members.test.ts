import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  createCloudApp,
  createBetterAuthAdapter,
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
    as(person: CloudActor) {
      actor = person
      return (path: string, init?: { method?: string; json?: unknown }) =>
        app.request(path, {
          method: init?.method ?? 'GET',
          headers: { 'Content-Type': 'application/json', Origin: config.publicURL },
          body: init?.json === undefined ? undefined : JSON.stringify(init.json)
        })
    }
  }
}

const createdSchema = v.object({
  invitation: v.object({ id: v.string(), email: v.string(), role: v.string() }),
  acceptanceURL: v.string()
})
const membersSchema = v.object({
  members: v.array(v.object({ email: v.string(), role: v.string() })),
  invitations: v.array(v.object({ email: v.string() }))
})

describe('workspace members', () => {
  test('invites by email, joins through the invitation link, and keeps an administrator', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await responseJSON(
        await as(people.alice)('/api/workspaces', { method: 'POST', json: { name: 'Studio' } }),
        v.object({ workspace: v.object({ id: v.string(), role: v.string() }) })
      )
      const workspaceId = created.workspace.id
      expect(created.workspace.role).toBe('admin')

      const invited = await responseJSON(
        await as(people.alice)(`/api/workspaces/${workspaceId}/invitations`, {
          method: 'POST',
          json: { email: ' Bob@Example.com ', role: 'editor' }
        }),
        createdSchema
      )
      expect(invited.invitation).toMatchObject({ email: 'bob@example.com', role: 'editor' })
      const link = new URL(invited.acceptanceURL)
      expect(link.origin).toBe('https://cloud.example.com')
      expect(link.pathname).toBe(`/invitations/${invited.invitation.id}`)
      const token = link.hash.slice(1)

      const listed = await responseJSON(
        await as(people.alice)(`/api/workspaces/${workspaceId}/members`),
        membersSchema
      )
      expect(listed.members.map((member) => member.email)).toEqual(['alice@example.com'])
      expect(listed.invitations.map((invitation) => invitation.email)).toEqual(['bob@example.com'])

      const preview = await as(people.bob)(
        `/api/public/invitations/${invited.invitation.id}/preview`,
        { method: 'POST', json: { token } }
      )
      expect(await preview.json()).toMatchObject({
        invitation: {
          kind: 'workspace',
          workspaceName: 'Studio',
          role: 'editor',
          inviterName: 'Alice'
        }
      })

      const wrongAccount = await as(people.carol)(
        `/api/invitations/${invited.invitation.id}/accept`,
        { method: 'POST', json: { token } }
      )
      expect(wrongAccount.status).toBe(404)

      const accepted = await as(people.bob)(`/api/invitations/${invited.invitation.id}/accept`, {
        method: 'POST',
        json: { token }
      })
      expect(await accepted.json()).toEqual({
        accepted: { kind: 'workspace', workspaceId, role: 'editor' }
      })
      const bobsWorkspaces = await responseJSON(
        await as(people.bob)('/api/workspaces'),
        v.object({ workspaces: v.array(v.object({ id: v.string() })) })
      )
      expect(bobsWorkspaces.workspaces.map((workspace) => workspace.id)).toContain(workspaceId)

      // Members other than administrators see who is in, not who is invited.
      const asMember = await responseJSON(
        await as(people.bob)(`/api/workspaces/${workspaceId}/members`),
        membersSchema
      )
      expect(asMember.members.map((member) => member.email)).toEqual([
        'alice@example.com',
        'bob@example.com'
      ])
      expect(asMember.invitations).toEqual([])
      const notAdmin = await as(people.bob)(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        json: { email: 'carol@example.com', role: 'viewer' }
      })
      expect(notAdmin.status).toBe(403)

      const lastAdmin = await as(people.alice)(
        `/api/workspaces/${workspaceId}/members/${people.alice.userId}`,
        { method: 'PATCH', json: { role: 'editor' } }
      )
      expect(lastAdmin.status).toBe(409)
      const aliceLeaves = await as(people.alice)(
        `/api/workspaces/${workspaceId}/members/${people.alice.userId}`,
        { method: 'DELETE' }
      )
      expect(aliceLeaves.status).toBe(409)

      const bobLeaves = await as(people.bob)(
        `/api/workspaces/${workspaceId}/members/${people.bob.userId}`,
        { method: 'DELETE' }
      )
      expect(bobLeaves.status).toBe(204)
      const again = await as(people.bob)(`/api/workspaces/${workspaceId}/members`)
      expect(again.status).toBe(404)
    } finally {
      await runtime.close()
    }
  })

  test('replaces an earlier invitation to the same address and lets an administrator withdraw it', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await responseJSON(
        await as(people.alice)('/api/workspaces', { method: 'POST', json: { name: 'Studio' } }),
        v.object({ workspace: v.object({ id: v.string() }) })
      )
      const workspaceId = created.workspace.id
      const invite = (role: string) =>
        as(people.alice)(`/api/workspaces/${workspaceId}/invitations`, {
          method: 'POST',
          json: { email: 'bob@example.com', role }
        })
      const first = await responseJSON(await invite('viewer'), createdSchema)
      const second = await responseJSON(await invite('editor'), createdSchema)

      const stale = await as(people.bob)(`/api/invitations/${first.invitation.id}/accept`, {
        method: 'POST',
        json: { token: new URL(first.acceptanceURL).hash.slice(1) }
      })
      expect(stale.status).toBe(404)

      const withdrawn = await as(people.alice)(
        `/api/workspaces/${workspaceId}/invitations/${second.invitation.id}`,
        { method: 'DELETE' }
      )
      expect(withdrawn.status).toBe(204)
      const listed = await responseJSON(
        await as(people.alice)(`/api/workspaces/${workspaceId}/members`),
        membersSchema
      )
      expect(listed.invitations).toEqual([])
    } finally {
      await runtime.close()
    }
  })
  test('resends a waiting invitation under a new link and names who sent it', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await responseJSON(
        await as(people.alice)('/api/workspaces', { method: 'POST', json: { name: 'Studio' } }),
        v.object({ workspace: v.object({ id: v.string() }) })
      )
      const workspaceId = created.workspace.id
      const first = await responseJSON(
        await as(people.alice)(`/api/workspaces/${workspaceId}/invitations`, {
          method: 'POST',
          json: { email: 'bob@example.com', role: 'viewer' }
        }),
        createdSchema
      )
      const resent = await responseJSON(
        await as(people.alice)(
          `/api/workspaces/${workspaceId}/invitations/${first.invitation.id}/resend`,
          { method: 'POST' }
        ),
        createdSchema
      )
      expect(resent.invitation).toMatchObject({ email: 'bob@example.com', role: 'viewer' })
      expect(resent.invitation.id).not.toBe(first.invitation.id)
      const listed = await responseJSON(
        await as(people.alice)(`/api/workspaces/${workspaceId}/members`),
        v.object({
          invitations: v.array(
            v.object({
              id: v.string(),
              invitedBy: v.object({ id: v.string(), name: v.nullable(v.string()) })
            })
          )
        })
      )
      expect(listed.invitations).toEqual([
        { id: resent.invitation.id, invitedBy: { id: people.alice.userId, name: 'Alice' } }
      ])

      const stale = await as(people.bob)(`/api/invitations/${first.invitation.id}/accept`, {
        method: 'POST',
        json: { token: new URL(first.acceptanceURL).hash.slice(1) }
      })
      expect(stale.status).toBe(404)
      const accepted = await as(people.bob)(`/api/invitations/${resent.invitation.id}/accept`, {
        method: 'POST',
        json: { token: new URL(resent.acceptanceURL).hash.slice(1) }
      })
      expect(accepted.status).toBe(200)

      const gone = await as(people.alice)(
        `/api/workspaces/${workspaceId}/invitations/${resent.invitation.id}/resend`,
        { method: 'POST' }
      )
      expect(gone.status).toBe(404)
      const notAdmin = await as(people.bob)(
        `/api/workspaces/${workspaceId}/invitations/${first.invitation.id}/resend`,
        { method: 'POST' }
      )
      expect(notAdmin.status).toBe(403)
    } finally {
      await runtime.close()
    }
  })
  test('deletes a workspace only once it holds no documents', async () => {
    const { runtime, as } = await testApp()
    try {
      const created = await responseJSON(
        await as(people.alice)('/api/workspaces', { method: 'POST', json: { name: 'Studio' } }),
        v.object({ workspace: v.object({ id: v.string() }) })
      )
      const workspaceId = created.workspace.id
      const documentId = crypto.randomUUID()
      await runtime.database
        .insertInto('document')
        .values({ id: documentId, workspaceId, name: 'Poster', createdBy: people.alice.userId })
        .execute()
      const remove = () => as(people.alice)(`/api/workspaces/${workspaceId}`, { method: 'DELETE' })

      const withDocument = await remove()
      expect(withDocument.status).toBe(409)
      expect(await withDocument.json()).toEqual({ error: { code: 'not_empty' } })

      await runtime.database
        .updateTable('document')
        .set({ deletedAt: new Date() })
        .where('id', '=', documentId)
        .execute()
      expect(await (await remove()).json()).toEqual({ error: { code: 'cleanup_pending' } })

      await runtime.database.deleteFrom('document').where('id', '=', documentId).execute()
      const notAdmin = await as(people.bob)(`/api/workspaces/${workspaceId}`, { method: 'DELETE' })
      expect(notAdmin.status).toBe(404)
      expect((await remove()).status).toBe(204)
      expect((await as(people.alice)(`/api/workspaces/${workspaceId}`)).status).toBe(404)
    } finally {
      await runtime.close()
    }
  })
})
