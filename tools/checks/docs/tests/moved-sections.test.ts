import { describe, expect, test } from 'bun:test'

import { movedSection } from '#docs-config/theme/moved-sections'

describe('moved Cloud sections', () => {
  // `_redirects` sends /user-guide/openpencil-cloud#your-account to /cloud/#your-account.
  test('sends a redirected section on to the page it moved to', () => {
    expect(movedSection('/cloud/', '#your-account')).toBe('/cloud/account')
    expect(movedSection('/cloud', '#version-history')).toBe('/cloud/documents#version-history')
    expect(movedSection('/cloud/self-hosting/', '#cloudflare-workers')).toBe(
      '/cloud/self-hosting/cloudflare'
    )
  })

  test('leaves sections that stayed, and other pages, alone', () => {
    expect(movedSection('/cloud/', '#connect-a-server')).toBeNull()
    expect(movedSection('/cloud/', '')).toBeNull()
    expect(movedSection('/cloud/account', '#your-account')).toBeNull()
  })
})
