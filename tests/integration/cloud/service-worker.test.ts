import { describe, expect, test } from 'bun:test'

import { CLOUD_PORTAL_PAGE_ROOTS } from '@open-pencil/cloud/contract'

import { servedByServer } from '@/service-worker/routes'

describe('editor service worker on a Cloud server', () => {
  test('leaves the server’s own pages and API to the server', () => {
    for (const root of CLOUD_PORTAL_PAGE_ROOTS) {
      expect(servedByServer(root)).toBe(true)
      expect(servedByServer(`${root}/x`)).toBe(true)
    }
    for (const path of ['/community', '/community/abc', '/community/abc/']) {
      expect(servedByServer(path)).toBe(true)
    }
    expect(servedByServer('/api/account/status')).toBe(true)
    expect(servedByServer('/.well-known/openpencil')).toBe(true)
    expect(servedByServer('/oauth/callback')).toBe(true)
  })

  test('serves the editor’s own pages offline', () => {
    for (const path of [
      '/',
      '/demo',
      '/rooms/abc',
      '/documents/abc',
      '/share/abc',
      '/invitations/abc',
      '/accounts',
      // A community document opens in the editor.
      '/community/abc/open'
    ]) {
      expect(servedByServer(path)).toBe(false)
    }
  })
})
