import { expect, test } from 'bun:test'

import { cloudEditorReturnURL, cloudRedirectPath, cloudSignInURL } from '#cloud/client'
import type { CloudDiscovery } from '#cloud/contract'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example/api',
  authURL: 'https://cloud.example/api/auth',
  localEditor: true,
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}

test('email-only instance owns sign-in and preserves an opaque invitation continuation', () => {
  const target = 'https://cloud.example/invitations/id?continuation=opaque'
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
    'https://editor.example',
    'https://cloud.example.evil.example',
    'https://user:secret@cloud.example',
    // eslint-disable-next-line no-script-url -- Reject script URLs at the untrusted navigation boundary.
    'javascript:alert(1)'
  ]) {
    expect(() => cloudEditorReturnURL(discovery, value)).toThrow()
  }
  expect(cloudEditorReturnURL(discovery, 'https://cloud.example/storage#secret')).toBe(
    'https://cloud.example/storage'
  )
})

test('a chosen provider rides along only when the server offers it', () => {
  const social = {
    ...discovery,
    authentication: { ...discovery.authentication, socialProviders: ['google' as const] }
  }
  const google = new URL(cloudSignInURL(social, 'https://cloud.example/', 'google'))
  expect(google.searchParams.get('provider')).toBe('google')
  const apple = new URL(cloudSignInURL(social, 'https://cloud.example/', 'apple'))
  expect(apple.searchParams.has('provider')).toBe(false)
})

test('authentication continuation stays on the issuing origin', () => {
  expect(cloudRedirectPath('/auth/device?user_code=ABCD')).toBe('/auth/device?user_code=ABCD')
  for (const input of [
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    // eslint-disable-next-line no-script-url -- Reject script URLs at the untrusted navigation boundary.
    'javascript:alert(1)',
    undefined
  ]) {
    expect(cloudRedirectPath(input)).toBe('/app')
  }
})
