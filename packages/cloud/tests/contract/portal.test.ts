import { describe, expect, test } from 'bun:test'

import { isCloudPortalPage } from '#cloud/contract'

describe('Cloud portal pages', () => {
  test('cover sign-in, desktop approval, account, and console paths', () => {
    for (const path of [
      '/auth/sign-in',
      '/cloud/device',
      '/account',
      '/account/pending',
      '/admin',
      '/admin/people'
    ])
      expect(isCloudPortalPage(path)).toBe(true)
  })

  test('leave the API, discovery, and look-alike paths to the server', () => {
    for (const path of [
      '/api/auth/sign-in/email',
      '/.well-known/openpencil-cloud',
      '/accounts',
      '/administrator',
      '/cloud/devices'
    ])
      expect(isCloudPortalPage(path)).toBe(false)
  })
})
