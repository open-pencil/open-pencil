import { describe, expect, test } from 'bun:test'

import { isCloudPortalPage } from '#cloud/contract'

describe('Cloud portal pages', () => {
  test('cover welcome, sign-in, desktop approval, account, and console paths', () => {
    for (const path of [
      '/welcome',
      '/auth/sign-in',
      '/auth/device',
      '/account',
      '/account/pending',
      '/admin',
      '/admin/people'
    ])
      expect(isCloudPortalPage(path)).toBe(true)
  })

  test('leave the editor, the API, discovery, and look-alike paths to the server', () => {
    for (const path of [
      '/',
      '/demo',
      '/documents/abc',
      '/share/abc',
      '/api/auth/sign-in/email',
      '/.well-known/openpencil-cloud',
      '/accounts',
      '/administrator',
      '/authors'
    ])
      expect(isCloudPortalPage(path)).toBe(false)
  })
})
