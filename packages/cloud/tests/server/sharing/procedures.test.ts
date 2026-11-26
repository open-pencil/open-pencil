import { expect, test } from 'bun:test'

import { asDouble } from '#cloud-tests/helpers/doubles'
import { contractRoutes } from '#cloud/server/api/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CloudActor } from '#cloud/server/auth'
import { cloudErrorHandler, type CloudErrorContext } from '#cloud/server/errors'
import { createPublicSharingProcedures } from '#cloud/server/sharing'
import { Hono, type Context } from 'hono'

const shareId = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const actor: CloudActor = { userId: 'user-1', email: 'jane@example.com', name: 'Jane' }

async function reportedOpening(signedIn: CloudActor | null): Promise<CloudErrorContext[]> {
  const reported: CloudErrorContext[] = []
  const procedures = createPublicSharingProcedures({
    sharing: asDouble({}),
    documents: asDouble({}),
    reports: asDouble({}),
    collaboration: {
      issueShareTicket: async () => {
        throw new Error('database unavailable')
      }
    },
    resolveSession: async () => signedIn
  })
  const app = new Hono<CloudAPIEnvironment>()
    .onError(
      cloudErrorHandler(async (_error, context) => {
        reported.push(context)
      })
    )
    .use(
      '/api/*',
      contractRoutes(procedures, (context: Context<CloudAPIEnvironment>) => ({
        request: context.req.raw,
        identify: (who) => context.set('actor', who)
      }))
    )
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

test('names the route and the share in the error report, as Hono routes do', async () => {
  const [report] = await reportedOpening(null)
  expect(report?.route).toBe('/api/shares/:shareId/collaboration-ticket')
  expect(report?.resources).toEqual({ shareId })
})
