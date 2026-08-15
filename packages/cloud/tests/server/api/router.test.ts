import { describe, expect, test } from 'bun:test'

import { Hono } from 'hono'

import {
  createCloudAPIRouter,
  type CloudActor,
  type CloudAPIEnvironment
} from '@open-pencil/cloud/server'

const actor: CloudActor = {
  userId: 'alice',
  email: 'alice@example.com',
  name: 'Alice'
}

function services() {
  return {
    documents: {
      cleanupExpiredUploads: async () => 0,
      list: async () => [],
      usage: async () => ({ bytesUsed: 0, objectCount: 0, documentCount: 0 }),
      access: async () => ({
        permission: 'edit' as const,
        canManageSharing: true,
        sources: ['owner' as const]
      }),
      download: async () => {
        throw new Error('not used')
      },
      remove: async () => undefined,
      create: async () => {
        throw new Error('not used')
      },
      createUpload: async () => {
        throw new Error('not used')
      },
      commitUpload: async () => {
        throw new Error('not used')
      }
    },
    workspaces: {
      list: async () => [],
      get: async () => undefined,
      create: async () => {
        throw new Error('not used')
      }
    }
  }
}

describe('createCloudAPIRouter', () => {
  test('exposes API-relative routes independently from deployment assembly', async () => {
    const router = createCloudAPIRouter(services())
    const app = new Hono<CloudAPIEnvironment>()
      .use('*', async (context, next) => {
        context.set('actor', actor)
        await next()
      })
      .route('/', router)

    const session = await app.request('/session')
    expect(session.status).toBe(200)
    expect(await session.json()).toEqual({ user: actor })

    const workspaces = await app.request('/workspaces')
    expect(workspaces.status).toBe(200)
    expect(await workspaces.json()).toEqual({ workspaces: [] })
  })
})
