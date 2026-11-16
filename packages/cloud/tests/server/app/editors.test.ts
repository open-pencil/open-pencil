import { describe, expect, test } from 'bun:test'

import { CLOUD_EDITOR_VERSION_HEADER } from '#cloud/contract'
import { requireMinimumEditor } from '#cloud/server/app/editors'
import { Hono } from 'hono'

function server(minimum: string | undefined) {
  return new Hono()
    .use('*', requireMinimumEditor(minimum))
    .get('/api/me', (context) => context.text('ok'))
}

function ask(app: Hono, version?: string) {
  const headers: Record<string, string> = version ? { [CLOUD_EDITOR_VERSION_HEADER]: version } : {}
  return app.request('/api/me', { headers })
}

describe('minimum editor version', () => {
  test('refuses an older editor with the version it needs', async () => {
    const response = await ask(server('0.17.0'), '0.16.4')
    expect(response.status).toBe(426)
    expect(await response.json()).toEqual({
      error: { code: 'editor_outdated' },
      minimumEditorVersion: '0.17.0'
    })
  })

  test('serves the minimum and later editors', async () => {
    expect((await ask(server('0.17.0'), '0.17.0')).status).toBe(200)
    expect((await ask(server('0.17.0'), '0.18.1')).status).toBe(200)
  })

  test('serves requests that name no version, and every editor when no minimum is set', async () => {
    expect((await ask(server('0.17.0'))).status).toBe(200)
    expect((await ask(server(undefined), '0.1.0')).status).toBe(200)
  })
})
