import { expect, test } from 'bun:test'

import { cloudEditorReturnURL, cloudSignInURL } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example/api',
  authURL: 'https://cloud.example/api/auth',
  appURL: 'https://editor.example',
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}

test('email-only instance owns sign-in and preserves an opaque invitation continuation', () => {
  const target =
    'https://editor.example/cloud/invitations/id?continuation=opaque&server=https%3A%2F%2Fcloud.example'
  const login = new URL(cloudSignInURL(discovery, target))
  expect(login.origin).toBe('https://cloud.example')
  expect(login.pathname).toBe('/auth/sign-in')
  const callback = new URL(login.searchParams.get('redirect') ?? '', login.origin)
  expect(callback.pathname).toBe('/auth/return')
  expect(cloudEditorReturnURL(discovery, callback.searchParams.get('editor') ?? '')).toBe(target)
})

test('return navigation rejects foreign origins and userinfo and strips fragment secrets', () => {
  for (const value of [
    'https://evil.example',
    'https://editor.example.evil.example',
    'https://user:secret@editor.example',
    // eslint-disable-next-line no-script-url -- Reject script URLs at the untrusted navigation boundary.
    'javascript:alert(1)'
  ]) {
    expect(() => cloudEditorReturnURL(discovery, value)).toThrow()
  }
  expect(cloudEditorReturnURL(discovery, 'https://editor.example/storage#secret')).toBe(
    'https://editor.example/storage'
  )
  expect(() =>
    cloudSignInURL({ ...discovery, appURL: undefined }, 'https://editor.example')
  ).toThrow()
})
