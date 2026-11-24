import { describe, expect, test } from 'bun:test'

import type { CloudActor } from '#cloud/server/auth'
import { refuseTokenRoute, scopesAllow, type TokenRoute } from '#cloud/server/tokens'

const person = { userId: 'user', email: 'person@example.com', name: 'Person' }
const reader: CloudActor = { ...person, credential: 'token', scopes: ['documents:read'] }
const writer: CloudActor = { ...person, credential: 'token', scopes: ['documents:write'] }
const app: CloudActor = {
  ...writer,
  credential: 'app',
  grant: { clientId: 'client', workspaceId: 'workspace' }
}
const route = (overrides: Partial<TokenRoute>): TokenRoute => ({
  scope: 'documents:read',
  target: 'document',
  narrowsToGrant: false,
  ...overrides
})

describe('token routes', () => {
  test('writing includes reading, never the other way', () => {
    expect(scopesAllow(['documents:write'], 'documents:read')).toBe(true)
    expect(scopesAllow(['documents:read'], 'documents:write')).toBe(false)
    expect(scopesAllow([], 'documents:read')).toBe(false)
  })

  test('refuse a route that declares nothing, or a scope the token lacks', () => {
    expect(refuseTokenRoute(writer, undefined)).toBe('not-declared')
    expect(refuseTokenRoute(reader, route({ scope: 'documents:write' }))).toBe('insufficient-scope')
    expect(refuseTokenRoute(reader, route({}))).toBeUndefined()
  })

  test('keep apps to routes about their grant', () => {
    expect(refuseTokenRoute(app, route({ target: 'account' }))).toBe('outside-grant')
    expect(
      refuseTokenRoute(app, route({ target: 'account', narrowsToGrant: true }))
    ).toBeUndefined()
    expect(refuseTokenRoute(app, route({ target: 'workspace' }))).toBeUndefined()
    expect(refuseTokenRoute(writer, route({ target: 'account' }))).toBeUndefined()
  })
})
