import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createWorkspaceMemberService } from '#cloud/server/workspaces'

/** A database with an owner's workspace, a member service that records seat notices, and people. */
async function setup() {
  const runtime = await createCloudTestDatabase()
  const { database } = runtime
  const person = async (name: string) => {
    const id = crypto.randomUUID()
    await database
      .insertInto('user')
      .values({ id, name, email: `${name}-${id}@example.com`, emailVerified: true })
      .execute()
    return id
  }
  const owner = await person('owner')
  const workspaceId = crypto.randomUUID()
  await database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Studio',
      slug: workspaceId,
      createdBy: owner,
      ownerId: owner
    })
    .execute()
  await database
    .insertInto('workspaceMember')
    .values({ workspaceId, userId: owner, role: 'admin' })
    .execute()
  const notices: string[][] = []
  const members = createWorkspaceMemberService(database, {
    publicURL: 'http://localhost:8787',
    onSeatsChanged: (accountIds) => notices.push([...accountIds].toSorted())
  })
  const join = (userId: string, role: 'admin' | 'editor' | 'viewer') =>
    database.insertInto('workspaceMember').values({ workspaceId, userId, role }).execute()
  return { runtime, owner, workspaceId, person, members, notices, join }
}

describe('seat notices', () => {
  test('tells the owner’s account when someone’s role changes or they leave', async () => {
    const context = await setup()
    try {
      const viewer = await context.person('viewer')
      await context.join(viewer, 'viewer')

      await context.members.updateRole(context.owner, context.workspaceId, viewer, 'editor')
      await context.members.remove(context.owner, context.workspaceId, viewer)

      expect(context.notices).toEqual([[context.owner], [context.owner]])
    } finally {
      await context.runtime.close()
    }
  })

  test('tells both accounts when ownership passes to another admin', async () => {
    const context = await setup()
    try {
      const successor = await context.person('successor')
      await context.join(successor, 'admin')

      await context.members.remove(context.owner, context.workspaceId, context.owner)

      expect(context.notices).toEqual([[context.owner, successor].toSorted()])
    } finally {
      await context.runtime.close()
    }
  })
})
