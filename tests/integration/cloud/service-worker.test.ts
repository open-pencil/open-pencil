import { describe, expect, test } from 'bun:test'

import { CLOUD_PORTAL_PAGE_ROOTS, isCloudPortalPage } from '@open-pencil/cloud/contract'
import { NOT_EDITOR_PAGES } from '@open-pencil/vite-config/pwa'

const servedByEditor = (path: string) => !NOT_EDITOR_PAGES.some((pattern) => pattern.test(path))

describe('editor service worker on a Cloud server', () => {
  test('leaves the server’s own pages and API to the server', () => {
    for (const root of CLOUD_PORTAL_PAGE_ROOTS) {
      expect(servedByEditor(root)).toBe(false)
      expect(servedByEditor(`${root}/x`)).toBe(false)
      // Workbox matches the path with its query, as a confirmation link that returns arrives.
      expect(servedByEditor(`${root}?confirmed`)).toBe(false)
    }
    expect(servedByEditor('/api/account/status')).toBe(false)
    expect(servedByEditor('/.well-known/openpencil')).toBe(false)
  })

  test('leaves the community gallery and its document pages to the server', () => {
    for (const path of ['/community', '/community/abc', '/community/abc/']) {
      expect(isCloudPortalPage(path)).toBe(true)
      expect(servedByEditor(path)).toBe(false)
      expect(servedByEditor(`${path}?ref=x`)).toBe(false)
    }
    // A community document opens in the editor.
    expect(isCloudPortalPage('/community/abc/open')).toBe(false)
    expect(servedByEditor('/community/abc/open')).toBe(true)
    expect(servedByEditor('/communityx')).toBe(true)
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
      '/?welcome'
    ]) {
      expect(servedByEditor(path)).toBe(true)
    }
  })
})
