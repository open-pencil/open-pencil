import { expect, test } from 'bun:test'

import type { CloudActor } from '#cloud/server/auth'
import { createPublicCollaborationRoutes } from '#cloud/server/collaboration'
import { cloudErrorHandler, type CloudErrorContext } from '#cloud/server/errors'
import { Hono } from 'hono'

const shareId = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const actor: CloudActor = { userId: 'user-1', email: 'jane@example.com', name: 'Jane' }

async function reportedOpening(signedIn: CloudActor | null): Promise<CloudErrorContext[]> {
  const reported: CloudErrorContext[] = []
  const routes = createPublicCollaborationRoutes(
    {
      issueShareTicket: async () => {
        throw new Error('database unavailable')
      }
    },
    async () => signedIn
  )
  const app = new Hono()
    .onError(
      cloudErrorHandler(async (_error, context) => {
        reported.push(context)
      })
    )
    .route('/api', routes)
  const response = await app.request(`/api/shares/${shareId}/collaboration-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: 's'.repeat(32) })
  })
  expect(response.status).toBe(500)
  return reported
}

test('names a signed-in caller of a share link in its error report, and no guest', async () => {
  expect((await reportedOpening(actor)).map((context) => context.userId)).toEqual(['user-1'])
  expect((await reportedOpening(null)).map((context) => context.userId)).toEqual([undefined])
})
