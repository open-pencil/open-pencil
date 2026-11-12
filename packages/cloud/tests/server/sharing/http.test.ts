import { describe, expect, test } from 'bun:test'

import { DocumentShareInvalidError, DocumentShareSignInRequiredError } from '#cloud/server'
import { sharingRoute } from '#cloud/server/sharing/http'
import { Hono } from 'hono'

const answer = (error: Error) =>
  new Hono()
    .get('/', (context) =>
      sharingRoute(context, () => {
        throw error
      })
    )
    .request('/')

describe('shared link answers', () => {
  test('ask a guest the server turns away to sign in', async () => {
    const response = await answer(new DocumentShareSignInRequiredError())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'unauthorized' } })
  })

  test('tell nothing about links that do not open', async () => {
    expect((await answer(new DocumentShareInvalidError())).status).toBe(404)
  })
})
